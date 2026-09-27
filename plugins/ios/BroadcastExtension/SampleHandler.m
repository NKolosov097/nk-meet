#import "SampleHandler.h"

#import "SampleUploader.h"
#import "SocketConnection.h"
#import "ScreenShareGenerated.h"

// Must match kRTCScreensharingSocketFD / kRTCAppGroupIdentifier in
// react-native-webrtc's ScreenCaptureController.
static NSString *const kScreenSharingSocketName = @"rtc_SSFD";
static NSString *const kAppGroupIdentifierKey = @"RTCAppGroupIdentifier";

@interface SampleHandler ()

@property(nonatomic, strong, nullable) SocketConnection *connection;
@property(nonatomic, strong, nullable) SampleUploader *uploader;
@property(nonatomic, copy, nullable) NSString *requestID;
@property(nonatomic, assign) BOOL hasFinishedBroadcast;
@property(nonatomic, assign) BOOL hasCleanedUp;

@end

@implementation SampleHandler

- (void)broadcastStartedWithSetupInfo:(NSDictionary<NSString *, NSObject *> *)setupInfo {
    NSString *appGroupIdentifier = [[NSBundle mainBundle] objectForInfoDictionaryKey:kAppGroupIdentifierKey];
    NSURL *sharedContainer = appGroupIdentifier
                                 ? [[NSFileManager defaultManager]
                                       containerURLForSecurityApplicationGroupIdentifier:appGroupIdentifier]
                                 : nil;
    NSUserDefaults *sharedDefaults = appGroupIdentifier
                                        ? [[NSUserDefaults alloc] initWithSuiteName:appGroupIdentifier]
                                        : nil;
    self.requestID = [sharedDefaults stringForKey:ScreenShareRequestIDKey];

    if (!sharedContainer || !self.requestID) {
        [self finishBroadcastWithReason:@"Screen sharing is not configured for this app."];
        return;
    }

    [self postStatus:@"starting"];
    NSString *socketFilePath = [[sharedContainer URLByAppendingPathComponent:kScreenSharingSocketName] path];

    self.connection = [[SocketConnection alloc] initWithFilePath:socketFilePath];

    if (!self.connection) {
        [self postStatus:@"failed"];
        [self finishBroadcastWithReason:@"Could not reach the app. Open it and try again."];
        return;
    }

    __weak __typeof__(self) weakSelf = self;
    self.connection.didClose = ^(NSError *_Nullable error) {
        [weakSelf finishBroadcastWithReason:@"The call ended."];
    };

    self.uploader = [[SampleUploader alloc] initWithConnection:self.connection];
    void (^uploaderDidOpen)(void) = self.connection.didOpen;
    self.connection.didOpen = ^{
        if (uploaderDidOpen) uploaderDidOpen();
        [weakSelf postStatus:@"ready"];
    };

    if (![self.connection open]) {
        [self postStatus:@"failed"];
        [self finishBroadcastWithReason:@"Could not reach the app. Open it and try again."];
    }
}

- (void)broadcastFinished {
    if (!ScreenShareBeginOnce(&_hasCleanedUp)) return;
    self.connection.didClose = nil;
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

- (void)postStatus:(NSString *)status {
    if (!self.requestID) return;
    NSString *name = ScreenShareNotificationName(self.requestID, status);
    CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(),
                                         (__bridge CFStringRef)name, NULL, NULL, true);
}

- (void)finishBroadcastWithReason:(NSString *)reason {
    if (!ScreenShareBeginOnce(&_hasFinishedBroadcast)) return;
    NSError *error = [NSError errorWithDomain:@"com.nkolosov.nkmeet.broadcast"
                                         code:0
                                     userInfo:@{NSLocalizedFailureReasonErrorKey : reason}];

    [self finishBroadcastWithError:error];
}

@end
