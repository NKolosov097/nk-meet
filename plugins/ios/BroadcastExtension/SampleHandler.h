#import <ReplayKit/ReplayKit.h>

NS_ASSUME_NONNULL_BEGIN

/// ReplayKit entry point for the broadcast upload extension. It opens the
/// shared-container socket the host app listens on and forwards video samples.
@interface SampleHandler : RPBroadcastSampleHandler

@end

NS_ASSUME_NONNULL_END
