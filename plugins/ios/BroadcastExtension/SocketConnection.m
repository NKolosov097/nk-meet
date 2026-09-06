#import "SocketConnection.h"

#include <sys/socket.h>
#include <sys/un.h>

@interface SocketConnection () <NSStreamDelegate>

@property(nonatomic, assign) int socketHandle;
@property(nonatomic, copy) NSString *filePath;
@property(nonatomic, strong, nullable) NSThread *networkThread;
@property(nonatomic, strong, nullable) NSInputStream *inputStream;
@property(nonatomic, strong, nullable) NSOutputStream *outputStream;

@end

@implementation SocketConnection

- (nullable instancetype)initWithFilePath:(NSString *)filePath {
    self = [super init];
    if (!self) {
        return nil;
    }

    self.filePath = filePath;
    self.socketHandle = socket(AF_UNIX, SOCK_STREAM, 0);

    if (self.socketHandle < 0) {
        NSLog(@"BroadcastExtension: failure creating socket");
        return nil;
    }

    [self setupNetworkThread];

    return self;
}

- (BOOL)open {
    if (![self connectSocket]) {
        return NO;
    }

    CFReadStreamRef readStream;
    CFWriteStreamRef writeStream;
    CFStreamCreatePairWithSocket(kCFAllocatorDefault, self.socketHandle, &readStream, &writeStream);

    self.inputStream = (__bridge_transfer NSInputStream *)readStream;
    self.outputStream = (__bridge_transfer NSOutputStream *)writeStream;
    self.inputStream.delegate = self;
    self.outputStream.delegate = self;
    [self.inputStream setProperty:@"kCFBooleanTrue" forKey:@"kCFStreamPropertyShouldCloseNativeSocket"];
    [self.outputStream setProperty:@"kCFBooleanTrue" forKey:@"kCFStreamPropertyShouldCloseNativeSocket"];

    [self.networkThread start];
    [self performSelector:@selector(scheduleStreams) onThread:self.networkThread withObject:nil waitUntilDone:YES];

    [self.inputStream open];
    [self.outputStream open];

    return YES;
}

- (void)close {
    if (!self.networkThread) {
        return;
    }

    [self performSelector:@selector(unscheduleStreams) onThread:self.networkThread withObject:nil waitUntilDone:YES];

    self.inputStream.delegate = nil;
    self.outputStream.delegate = nil;
    [self.inputStream close];
    [self.outputStream close];
    self.inputStream = nil;
    self.outputStream = nil;

    [self.networkThread cancel];
    self.networkThread = nil;
}

- (NSInteger)writeBuffer:(const uint8_t *)buffer length:(NSUInteger)length {
    if (!self.outputStream.hasSpaceAvailable) {
        return 0;
    }

    return [self.outputStream write:buffer maxLength:length];
}

// MARK: - NSStreamDelegate

- (void)stream:(NSStream *)stream handleEvent:(NSStreamEvent)eventCode {
    switch (eventCode) {
        case NSStreamEventOpenCompleted:
            if (stream == self.inputStream && self.didOpen) {
                self.didOpen();
            }
            break;
        case NSStreamEventHasSpaceAvailable:
            if (stream == self.outputStream && self.streamHasSpaceAvailable) {
                self.streamHasSpaceAvailable();
            }
            break;
        case NSStreamEventErrorOccurred:
            NSLog(@"BroadcastExtension: stream error %@", stream.streamError.localizedDescription);
            if (self.didClose) {
                self.didClose(stream.streamError);
            }
            break;
        case NSStreamEventEndEncountered:
            if (self.didClose) {
                self.didClose(nil);
            }
            break;
        default:
            break;
    }
}

// MARK: - Private Methods

- (void)setupNetworkThread {
    self.networkThread = [[NSThread alloc] initWithBlock:^{
        do {
            @autoreleasepool {
                [[NSRunLoop currentRunLoop] run];
            }
        } while (![NSThread currentThread].isCancelled);
    }];
    self.networkThread.qualityOfService = NSQualityOfServiceUserInitiated;
}

- (BOOL)connectSocket {
    struct sockaddr_un addr;
    memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;

    if (self.filePath.length >= sizeof(addr.sun_path)) {
        NSLog(@"BroadcastExtension: socket path too long");
        return NO;
    }

    strncpy(addr.sun_path, self.filePath.UTF8String, sizeof(addr.sun_path) - 1);

    if (connect(self.socketHandle, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        NSLog(@"BroadcastExtension: failure connecting to the host app socket");
        return NO;
    }

    return YES;
}

- (void)scheduleStreams {
    [self.inputStream scheduleInRunLoop:NSRunLoop.currentRunLoop forMode:NSRunLoopCommonModes];
    [self.outputStream scheduleInRunLoop:NSRunLoop.currentRunLoop forMode:NSRunLoopCommonModes];
}

- (void)unscheduleStreams {
    [self.inputStream removeFromRunLoop:NSRunLoop.currentRunLoop forMode:NSRunLoopCommonModes];
    [self.outputStream removeFromRunLoop:NSRunLoop.currentRunLoop forMode:NSRunLoopCommonModes];
}

@end
