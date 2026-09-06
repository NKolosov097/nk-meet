#import <CoreMedia/CoreMedia.h>
#import <Foundation/Foundation.h>

#import "SocketConnection.h"

NS_ASSUME_NONNULL_BEGIN

/// Encodes ReplayKit sample buffers as JPEG and frames them the way
/// `ScreenCapturer` in the host app expects: a CFHTTPMessage carrying
/// Content-Length plus the Buffer-Width/Height/Orientation headers.
@interface SampleUploader : NSObject

- (instancetype)initWithConnection:(SocketConnection *)connection;
- (void)sendSample:(CMSampleBufferRef)sampleBuffer;

@end

NS_ASSUME_NONNULL_END
