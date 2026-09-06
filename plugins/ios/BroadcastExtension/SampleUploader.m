#import "SampleUploader.h"

#import <CoreImage/CoreImage.h>
#import <ReplayKit/ReplayKit.h>

static const CGFloat kJpegCompressionQuality = 1.0;

@interface SampleUploader ()

@property(nonatomic, strong) SocketConnection *connection;
@property(nonatomic, strong, nullable) NSData *dataToSend;
@property(nonatomic, assign) NSUInteger byteIndex;
@property(nonatomic, strong) dispatch_queue_t serialQueue;
@property(atomic, assign) BOOL isReady;

@end

@implementation SampleUploader

- (instancetype)initWithConnection:(SocketConnection *)connection {
    self = [super init];
    if (!self) {
        return nil;
    }

    self.connection = connection;
    self.serialQueue = dispatch_queue_create("com.nkolosov.nkmeet.broadcast.uploader", DISPATCH_QUEUE_SERIAL);

    __weak __typeof__(self) weakSelf = self;
    connection.didOpen = ^{
        weakSelf.isReady = YES;
    };
    connection.streamHasSpaceAvailable = ^{
        dispatch_async(weakSelf.serialQueue, ^{
            weakSelf.isReady = ![weakSelf sendNonBlocking];
        });
    };

    return self;
}

- (void)sendSample:(CMSampleBufferRef)sampleBuffer {
    if (!self.isReady) {
        return;
    }

    self.isReady = NO;

    NSData *framedMessage = [self framedMessageForSample:sampleBuffer];
    if (!framedMessage) {
        self.isReady = YES;
        return;
    }

    dispatch_async(self.serialQueue, ^{
        self.dataToSend = framedMessage;
        self.byteIndex = 0;
        [self sendNonBlocking];
    });
}

// MARK: - Private Methods

/// Writes as much of the pending message as the socket accepts. Returns YES
/// once the whole message is out, so the caller can take the next sample.
- (BOOL)sendNonBlocking {
    if (!self.dataToSend) {
        return YES;
    }

    NSUInteger remaining = self.dataToSend.length - self.byteIndex;
    if (remaining == 0) {
        self.dataToSend = nil;
        return YES;
    }

    const uint8_t *bytes = (const uint8_t *)self.dataToSend.bytes + self.byteIndex;
    NSInteger written = [self.connection writeBuffer:bytes length:remaining];

    if (written < 0) {
        NSLog(@"BroadcastExtension: failure writing the frame to the host app");
        self.dataToSend = nil;
        return YES;
    }

    self.byteIndex += (NSUInteger)written;

    if (self.byteIndex >= self.dataToSend.length) {
        self.dataToSend = nil;
        return YES;
    }

    return NO;
}

- (nullable NSData *)framedMessageForSample:(CMSampleBufferRef)sampleBuffer {
    CVImageBufferRef imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
    if (!imageBuffer) {
        return nil;
    }

    NSData *jpegData = [self jpegDataForImageBuffer:imageBuffer];
    if (!jpegData) {
        return nil;
    }

    CFHTTPMessageRef message = CFHTTPMessageCreateRequest(kCFAllocatorDefault, CFSTR("POST"),
                                                          (__bridge CFURLRef)[NSURL URLWithString:@"/"],
                                                          kCFHTTPVersion1_1);
    CFHTTPMessageSetHeaderFieldValue(message, CFSTR("Content-Length"),
                                     (__bridge CFStringRef)[NSString stringWithFormat:@"%lu",
                                                                                      (unsigned long)jpegData.length]);
    CFHTTPMessageSetHeaderFieldValue(
        message, CFSTR("Buffer-Width"),
        (__bridge CFStringRef)[NSString stringWithFormat:@"%zu", CVPixelBufferGetWidth(imageBuffer)]);
    CFHTTPMessageSetHeaderFieldValue(
        message, CFSTR("Buffer-Height"),
        (__bridge CFStringRef)[NSString stringWithFormat:@"%zu", CVPixelBufferGetHeight(imageBuffer)]);
    CFHTTPMessageSetHeaderFieldValue(
        message, CFSTR("Buffer-Orientation"),
        (__bridge CFStringRef)[NSString stringWithFormat:@"%d", [self orientationForSample:sampleBuffer]]);
    CFHTTPMessageSetBody(message, (__bridge CFDataRef)jpegData);

    NSData *serializedMessage = CFBridgingRelease(CFHTTPMessageCopySerializedMessage(message));
    CFRelease(message);

    return serializedMessage;
}

- (nullable NSData *)jpegDataForImageBuffer:(CVImageBufferRef)imageBuffer {
    // A CIContext is expensive to build, so it is shared across every frame.
    static CIContext *imageContext = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        imageContext = [[CIContext alloc] initWithOptions:nil];
    });

    CIImage *image = [CIImage imageWithCVPixelBuffer:imageBuffer];
    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
    NSData *jpegData = [imageContext JPEGRepresentationOfImage:image
                                                    colorSpace:colorSpace
                                                       options:@{
                                                           (__bridge id)
                                                           kCGImageDestinationLossyCompressionQuality :
                                                               @(kJpegCompressionQuality)
                                                       }];
    CGColorSpaceRelease(colorSpace);

    return jpegData;
}

/// ReplayKit attaches the device orientation as a sample attachment; the host
/// app maps it back onto an RTCVideoRotation.
- (int)orientationForSample:(CMSampleBufferRef)sampleBuffer {
    CFArrayRef attachmentsArray = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, false);
    if (!attachmentsArray || CFArrayGetCount(attachmentsArray) == 0) {
        return kCGImagePropertyOrientationUp;
    }

    CFDictionaryRef attachments = CFArrayGetValueAtIndex(attachmentsArray, 0);
    CFTypeRef orientation = CFDictionaryGetValue(attachments, (__bridge CFStringRef)RPVideoSampleOrientationKey);
    if (!orientation) {
        return kCGImagePropertyOrientationUp;
    }

    return ((__bridge NSNumber *)orientation).intValue;
}

@end
