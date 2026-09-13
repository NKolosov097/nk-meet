#import <React/RCTBridge.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUIManager.h>
#import <ReplayKit/ReplayKit.h>

static CFStringRef const kBroadcastStartedNotification = CFSTR("com.nkolosov.nkmeet.broadcast.started");

@interface BroadcastPicker : NSObject <RCTBridgeModule>

@property(nonatomic, weak) RCTBridge *bridge;
@property(nonatomic, copy, nullable) RCTPromiseResolveBlock resolve;
@property(nonatomic, copy, nullable) RCTPromiseRejectBlock reject;
@property(nonatomic, assign) BOOL didResignActive;
@property(nonatomic, assign) NSUInteger requestID;

@end

static void BroadcastStarted(__unused CFNotificationCenterRef center, const void *observer,
                             __unused CFStringRef name, __unused const void *object,
                             __unused CFDictionaryRef userInfo) {
    [(__bridge BroadcastPicker *)observer broadcastStarted];
}

@implementation BroadcastPicker

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (instancetype)init {
    self = [super init];
    if (!self) {
        return nil;
    }

    NSNotificationCenter *notifications = NSNotificationCenter.defaultCenter;
    [notifications addObserver:self
                      selector:@selector(applicationWillResignActive)
                          name:UIApplicationWillResignActiveNotification
                        object:nil];
    [notifications addObserver:self
                      selector:@selector(applicationDidBecomeActive)
                          name:UIApplicationDidBecomeActiveNotification
                        object:nil];
    CFNotificationCenterAddObserver(CFNotificationCenterGetDarwinNotifyCenter(), (__bridge const void *)self,
                                    BroadcastStarted, kBroadcastStartedNotification, NULL,
                                    CFNotificationSuspensionBehaviorDeliverImmediately);

    return self;
}

- (void)dealloc {
    [NSNotificationCenter.defaultCenter removeObserver:self];
    CFNotificationCenterRemoveObserver(CFNotificationCenterGetDarwinNotifyCenter(), (__bridge const void *)self,
                                       kBroadcastStartedNotification, NULL);
}

RCT_EXPORT_METHOD(present
                  : (nonnull NSNumber *)reactTag resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.resolve) {
            reject(@"broadcast_picker_busy", @"The broadcast picker is already open.", nil);
            return;
        }

        self.resolve = resolve;
        self.reject = reject;
        self.didResignActive = NO;
        NSUInteger requestID = ++self.requestID;

        [self.bridge.uiManager
            addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
                UIView *view = viewRegistry[reactTag];
                if (![view isKindOfClass:[RPSystemBroadcastPickerView class]]) {
                    [self fail:@"broadcast_picker_unavailable" message:@"Broadcast picker view not found."];
                    return;
                }

                for (UIView *subview in view.subviews) {
                    if ([subview isKindOfClass:[UIButton class]]) {
                        [(UIButton *)subview sendActionsForControlEvents:UIControlEventTouchUpInside];
                        [self rejectRequestIfTimedOut:requestID];
                        return;
                    }
                }

                [self fail:@"broadcast_picker_unavailable" message:@"Broadcast picker button not found."];
            }];
    });
}

- (void)applicationWillResignActive {
    if (self.resolve) {
        self.didResignActive = YES;
    }
}

- (void)applicationDidBecomeActive {
    if (!self.resolve || !self.didResignActive) {
        return;
    }

    NSUInteger requestID = self.requestID;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        if (self.resolve && self.requestID == requestID && !UIScreen.mainScreen.isCaptured) {
            [self fail:@"broadcast_cancelled" message:@"Broadcast picker was dismissed."];
        }
    });
}

- (void)broadcastStarted {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.resolve) {
            return;
        }

        RCTPromiseResolveBlock resolve = self.resolve;
        [self clearRequest];
        resolve(nil);
    });
}

- (void)rejectRequestIfTimedOut:(NSUInteger)requestID {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(120 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        if (self.resolve && self.requestID == requestID) {
            [self fail:@"broadcast_picker_timeout" message:@"Broadcast picker did not finish."];
        }
    });
}

- (void)fail:(NSString *)code message:(NSString *)message {
    RCTPromiseRejectBlock reject = self.reject;
    [self clearRequest];
    reject(code, message, nil);
}

- (void)clearRequest {
    self.resolve = nil;
    self.reject = nil;
    self.didResignActive = NO;
}

@end
