#import "SampleUploader.h"

#import <CoreImage/CoreImage.h>
#import <ReplayKit/ReplayKit.h>

#import "ScreenShareGenerated.h"

// ponytail: device heat/bandwidth ceiling; tune these on physical devices.
static const CGFloat kJpegCompressionQuality = 0.7;
static const CGFloat kMaximumFrameDimension = 1920;
static const NSTimeInterval kMinimumFrameInterval = 1.0 / 15.0;

typedef NS_ENUM(NSUInteger, SampleUploaderState) {
    SampleUploaderStateClosed,
    SampleUploaderStateReady,
    SampleUploaderStateWriting,
    SampleUploaderStateFailed,
};

@interface SampleUploader ()

@property(nonatomic, strong) SocketConnection *connection;
@property(nonatomic, strong, nullable) NSData *dataToSend;
@property(nonatomic, assign) NSUInteger byteIndex;
@property(nonatomic, strong) dispatch_queue_t serialQueue;
@property(nonatomic, assign) SampleUploaderState state;
@property(nonatomic, assign) CMTime lastFrameTime;

@end

@implementation SampleUploader

- (instancetype)initWithConnection:(SocketConnection *)connection {
    self = [super init];
    if (!self) {
        return nil;
    }

    self.connection = connection;
    self.serialQueue = dispatch_queue_create("com.nkolosov.nkmeet.broadcast.uploader", DISPATCH_QUEUE_SERIAL);
    self.state = SampleUploaderStateClosed;
    self.lastFrameTime = kCMTimeInvalid;

    __weak __typeof__(self) weakSelf = self;
    connection.didOpen = ^{
        dispatch_async(weakSelf.serialQueue, ^{
            weakSelf.state = SampleUploaderStateReady;
        });
    };
    connection.streamHasSpaceAvailable = ^{
        dispatch_async(weakSelf.serialQueue, ^{
            [weakSelf sendNonBlocking];
        });
    };

    return self;
}

- (void)sendSample:(CMSampleBufferRef)sampleBuffer {
    dispatch_sync(self.serialQueue, ^{
        if (self.state != SampleUploaderStateReady || ![self shouldSendSample:sampleBuffer]) {
            return;
        }

        NSData *framedMessage = [self framedMessageForSample:sampleBuffer];
        if (!framedMessage) {
            return;
        }

        self.state = SampleUploaderStateWriting;
        self.dataToSend = framedMessage;
        self.byteIndex = 0;
        [self sendNonBlocking];
    });
}

// MARK: - Private Methods

/// Writes one chunk and leaves the state ready only after the complete frame.
- (void)sendNonBlocking {
    if (!self.dataToSend) {
        return;
    }

    NSUInteger remaining = self.dataToSend.length - self.byteIndex;
    if (remaining == 0) {
        self.dataToSend = nil;
        self.state = SampleUploaderStateReady;
        return;
    }

    const uint8_t *bytes = (const uint8_t *)self.dataToSend.bytes + self.byteIndex;
    NSInteger written = [self.connection writeBuffer:bytes length:remaining];
    NSInteger nextState = ScreenShareStateAfterWrite(remaining, written);

    if (nextState < 0) {
        NSLog(@"BroadcastExtension: failure writing the frame to the host app");
        self.dataToSend = nil;
        self.state = SampleUploaderStateFailed;
        return;
    }

    self.byteIndex += (NSUInteger)written;

    if (nextState > 0) {
        self.dataToSend = nil;
        self.state = SampleUploaderStateReady;
    }
}

- (BOOL)shouldSendSample:(CMSampleBufferRef)sampleBuffer {
    CMTime frameTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer);
    if (CMTIME_IS_VALID(self.lastFrameTime)) {
        NSTimeInterval elapsed = CMTimeGetSeconds(CMTimeSubtract(frameTime, self.lastFrameTime));
        if (elapsed >= 0 && elapsed < kMinimumFrameInterval) {
            return NO;
        }
    }

    self.lastFrameTime = frameTime;
    return YES;
}

- (nullable NSData *)framedMessageForSample:(CMSampleBufferRef)sampleBuffer {
    CVImageBufferRef imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
    if (!imageBuffer) {
        return nil;
    }

    size_t sourceWidth = CVPixelBufferGetWidth(imageBuffer);
    size_t sourceHeight = CVPixelBufferGetHeight(imageBuffer);
    CGFloat scale = MIN(1.0, kMaximumFrameDimension / MAX(sourceWidth, sourceHeight));
    size_t encodedWidth = (size_t)lrint(sourceWidth * scale);
    size_t encodedHeight = (size_t)lrint(sourceHeight * scale);
    NSData *jpegData = [self jpegDataForImageBuffer:imageBuffer
                                             width:encodedWidth
                                            height:encodedHeight];
    if (!jpegData) {
        return nil;
    }

    CFHTTPMessageRef message =
        CFHTTPMessageCreateResponse(kCFAllocatorDefault, ScreenShareHTTPStatusCode, NULL, kCFHTTPVersion1_1);
    CFHTTPMessageSetHeaderFieldValue(message, ScreenShareContentLengthHeader,
                                     (__bridge CFStringRef)[NSString stringWithFormat:@"%lu",
                                                                                      (unsigned long)jpegData.length]);
    CFHTTPMessageSetHeaderFieldValue(
        message, ScreenShareWidthHeader,
        (__bridge CFStringRef)[NSString stringWithFormat:@"%zu", encodedWidth]);
    CFHTTPMessageSetHeaderFieldValue(
        message, ScreenShareHeightHeader,
        (__bridge CFStringRef)[NSString stringWithFormat:@"%zu", encodedHeight]);
    CFHTTPMessageSetHeaderFieldValue(
        message, ScreenShareOrientationHeader,
        (__bridge CFStringRef)[NSString stringWithFormat:@"%d", [self orientationForSample:sampleBuffer]]);
    CFHTTPMessageSetBody(message, (__bridge CFDataRef)jpegData);

    NSData *serializedMessage = CFBridgingRelease(CFHTTPMessageCopySerializedMessage(message));
    CFRelease(message);

    return serializedMessage;
}

- (nullable NSData *)jpegDataForImageBuffer:(CVImageBufferRef)imageBuffer
                                      width:(size_t)width
                                     height:(size_t)height {
    // A CIContext is expensive to build, so it is shared across every frame.
    static CIContext *imageContext = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        imageContext = [[CIContext alloc] initWithOptions:nil];
    });

    CIImage *image = [CIImage imageWithCVPixelBuffer:imageBuffer];
    CGFloat scaleX = (CGFloat)width / CVPixelBufferGetWidth(imageBuffer);
    CGFloat scaleY = (CGFloat)height / CVPixelBufferGetHeight(imageBuffer);
    image = [image imageByApplyingTransform:CGAffineTransformMakeScale(scaleX, scaleY)];
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

/// ReplayKit attaches the device orientation to the sample buffer; the host
/// app maps it back onto an RTCVideoRotation.
- (int)orientationForSample:(CMSampleBufferRef)sampleBuffer {
    CFTypeRef orientation = CMGetAttachment(sampleBuffer, (__bridge CFStringRef)RPVideoSampleOrientationKey, NULL);
    if (!orientation) {
        return kCGImagePropertyOrientationUp;
    }

    return ((__bridge NSNumber *)orientation).intValue;
}

@end
