#import <React/RCTBridge.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUIManager.h>
#import <ReplayKit/ReplayKit.h>

#import "ScreenShareGenerated.h"

static NSString *const kAppGroupIdentifierKey = @"RTCAppGroupIdentifier";
static const NSTimeInterval kCancellationGracePeriod = 0.75;
static const NSTimeInterval kTransportTimeout = 10.0;

@interface BroadcastPicker : NSObject <RCTBridgeModule>

@property(nonatomic, weak) RCTBridge *bridge;
@property(nonatomic, copy, nullable) RCTPromiseResolveBlock resolve;
@property(nonatomic, copy, nullable) RCTPromiseRejectBlock reject;
@property(nonatomic, copy, nullable) NSString *requestID;
@property(nonatomic, copy, nullable) NSString *startingNotification;
@property(nonatomic, copy, nullable) NSString *readyNotification;
@property(nonatomic, copy, nullable) NSString *failedNotification;
@property(nonatomic, assign) BOOL didResignActive;
@property(nonatomic, assign) BOOL extensionStarted;

@end

static void BroadcastStatusChanged(__unused CFNotificationCenterRef center, const void *observer,
                                   CFStringRef name, __unused const void *object,
                                   __unused CFDictionaryRef userInfo) {
    [(__bridge BroadcastPicker *)observer broadcastStatusChanged:(__bridge NSString *)name];
}

@implementation BroadcastPicker

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (instancetype)init {
    self = [super init];
    if (!self) return nil;

    NSNotificationCenter *notifications = NSNotificationCenter.defaultCenter;
    [notifications addObserver:self selector:@selector(applicationWillResignActive)
                          name:UIApplicationWillResignActiveNotification object:nil];
    [notifications addObserver:self selector:@selector(applicationDidBecomeActive)
                          name:UIApplicationDidBecomeActiveNotification object:nil];
    return self;
}

- (void)dealloc {
    [NSNotificationCenter.defaultCenter removeObserver:self];
    [self removeDarwinObservers];
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

        NSString *appGroupIdentifier = [[NSBundle mainBundle] objectForInfoDictionaryKey:kAppGroupIdentifierKey];
        if (!appGroupIdentifier) {
            reject(@"broadcast_picker_unavailable", @"Screen sharing App Group is not configured.", nil);
            return;
        }

        self.resolve = resolve;
        self.reject = reject;
        self.requestID = NSUUID.UUID.UUIDString;
        self.didResignActive = NO;
        self.extensionStarted = NO;
        self.startingNotification = ScreenShareNotificationName(self.requestID, @"starting");
        self.readyNotification = ScreenShareNotificationName(self.requestID, @"ready");
        self.failedNotification = ScreenShareNotificationName(self.requestID, @"failed");

        NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:appGroupIdentifier];
        [sharedDefaults setObject:self.requestID forKey:ScreenShareRequestIDKey];
        [sharedDefaults synchronize];
        [self addDarwinObservers];

        NSString *requestID = self.requestID;
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
    if (self.resolve) self.didResignActive = YES;
}

- (void)applicationDidBecomeActive {
    if (!self.resolve || !self.didResignActive) return;

    NSString *requestID = self.requestID;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kCancellationGracePeriod * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
                       if (self.resolve && [self.requestID isEqualToString:requestID] && !self.extensionStarted) {
                           [self fail:@"broadcast_cancelled" message:@"Broadcast picker was dismissed."];
                       }
                   });
}

- (void)broadcastStatusChanged:(NSString *)notificationName {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.resolve) return;
        if ([notificationName isEqualToString:self.startingNotification]) {
            self.extensionStarted = YES;
        } else if ([notificationName isEqualToString:self.readyNotification]) {
            RCTPromiseResolveBlock resolve = self.resolve;
            [self clearRequest];
            resolve(nil);
        } else if ([notificationName isEqualToString:self.failedNotification]) {
            [self fail:@"broadcast_transport_failed" message:@"Could not connect to the host transport."];
        }
    });
}

- (void)rejectRequestIfTimedOut:(NSString *)requestID {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kTransportTimeout * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
                       if (self.resolve && [self.requestID isEqualToString:requestID]) {
                           [self fail:@"broadcast_picker_timeout" message:@"Broadcast extension did not become ready."];
                       }
                   });
}

- (void)addDarwinObservers {
    CFNotificationCenterRef center = CFNotificationCenterGetDarwinNotifyCenter();
    for (NSString *name in @[ self.startingNotification, self.readyNotification, self.failedNotification ]) {
        CFNotificationCenterAddObserver(center, (__bridge const void *)self, BroadcastStatusChanged,
                                        (__bridge CFStringRef)name, NULL,
                                        CFNotificationSuspensionBehaviorDeliverImmediately);
    }
}

- (void)removeDarwinObservers {
    CFNotificationCenterRef center = CFNotificationCenterGetDarwinNotifyCenter();
    for (NSString *name in @[ self.startingNotification ?: @"", self.readyNotification ?: @"",
                              self.failedNotification ?: @"" ]) {
        if (name.length > 0) {
            CFNotificationCenterRemoveObserver(center, (__bridge const void *)self,
                                               (__bridge CFStringRef)name, NULL);
        }
    }
}

- (void)fail:(NSString *)code message:(NSString *)message {
    RCTPromiseRejectBlock reject = self.reject;
    [self clearRequest];
    if (reject) reject(code, message, nil);
}

- (void)clearRequest {
    NSString *appGroupIdentifier = [[NSBundle mainBundle] objectForInfoDictionaryKey:kAppGroupIdentifierKey];
    NSUserDefaults *sharedDefaults = [[NSUserDefaults alloc] initWithSuiteName:appGroupIdentifier];
    if ([[sharedDefaults stringForKey:ScreenShareRequestIDKey] isEqualToString:self.requestID]) {
        [sharedDefaults removeObjectForKey:ScreenShareRequestIDKey];
        [sharedDefaults synchronize];
    }
    [self removeDarwinObservers];
    self.resolve = nil;
    self.reject = nil;
    self.requestID = nil;
    self.startingNotification = nil;
    self.readyNotification = nil;
    self.failedNotification = nil;
    self.didResignActive = NO;
    self.extensionStarted = NO;
}

@end
