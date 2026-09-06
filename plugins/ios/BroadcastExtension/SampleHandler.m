#import "SampleHandler.h"

#import "SampleUploader.h"
#import "SocketConnection.h"

// Must match kRTCScreensharingSocketFD / kRTCAppGroupIdentifier in
// react-native-webrtc's ScreenCaptureController.
static NSString *const kScreenSharingSocketName = @"rtc_SSFD";
static NSString *const kAppGroupIdentifierKey = @"RTCAppGroupIdentifier";

@interface SampleHandler ()

@property(nonatomic, strong, nullable) SocketConnection *connection;
@property(nonatomic, strong, nullable) SampleUploader *uploader;

@end

@implementation SampleHandler

- (void)broadcastStartedWithSetupInfo:(NSDictionary<NSString *, NSObject *> *)setupInfo {
    NSString *socketFilePath = [self socketFilePath];

    if (!socketFilePath) {
        [self finishBroadcastWithReason:@"Screen sharing is not configured for this app."];
        return;
    }

    self.connection = [[SocketConnection alloc] initWithFilePath:socketFilePath];

    if (!self.connection) {
        [self finishBroadcastWithReason:@"Could not reach the app. Open it and try again."];
        return;
    }

    __weak __typeof__(self) weakSelf = self;
    self.connection.didClose = ^(NSError *_Nullable error) {
        [weakSelf finishBroadcastWithReason:@"The call ended."];
    };

    self.uploader = [[SampleUploader alloc] initWithConnection:self.connection];

    if (![self.connection open]) {
        [self finishBroadcastWithReason:@"Could not reach the app. Open it and try again."];
    }
}

- (void)broadcastFinished {
    [self.connection close];
    self.connection = nil;
    self.uploader = nil;
}

- (void)processSampleBuffer:(CMSampleBufferRef)sampleBuffer
                   withType:(RPSampleBufferType)sampleBufferType {
    // Audio is published from the app's own microphone track, so only video
    // samples travel through the socket.
    if (sampleBufferType != RPSampleBufferTypeVideo) {
        return;
    }

    [self.uploader sendSample:sampleBuffer];
}

// MARK: - Private Methods

- (nullable NSString *)socketFilePath {
    NSString *appGroupIdentifier = [[NSBundle mainBundle] objectForInfoDictionaryKey:kAppGroupIdentifierKey];

    if (!appGroupIdentifier) {
        return nil;
    }

    NSURL *sharedContainer =
        [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:appGroupIdentifier];

    return [[sharedContainer URLByAppendingPathComponent:kScreenSharingSocketName] path];
}

- (void)finishBroadcastWithReason:(NSString *)reason {
    NSError *error = [NSError errorWithDomain:@"com.nkolosov.nkmeet.broadcast"
                                         code:0
                                     userInfo:@{NSLocalizedFailureReasonErrorKey : reason}];

    [self finishBroadcastWithError:error];
}

@end
