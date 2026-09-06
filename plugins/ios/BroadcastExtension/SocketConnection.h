#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Client end of the unix domain socket that the host app listens on inside the
/// shared App Group container. The broadcast extension pushes encoded frames
/// through it; `ScreenCapturer` in the app reads them back.
@interface SocketConnection : NSObject

// Fired once the socket streams are open and ready to accept frames.
@property(nonatomic, copy, nullable) void (^didOpen)(void);
// Fired when the app closes the connection or the socket errors out.
@property(nonatomic, copy, nullable) void (^didClose)(NSError *_Nullable error);
// Fired whenever the output stream can take more bytes.
@property(nonatomic, copy, nullable) void (^streamHasSpaceAvailable)(void);

- (nullable instancetype)initWithFilePath:(NSString *)filePath;
- (BOOL)open;
- (void)close;
- (NSInteger)writeBuffer:(const uint8_t *)buffer length:(NSUInteger)length;

@end

NS_ASSUME_NONNULL_END
