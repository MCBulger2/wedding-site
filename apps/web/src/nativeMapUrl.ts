export interface NativeMapUrls {
  googleMapsUrl: string;
  appleMapsUrl: string;
}

export type NavigatorLike = Pick<
  Navigator,
  'maxTouchPoints' | 'platform' | 'userAgent'
>;

function getBrowserNavigator(): NavigatorLike | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

export function getNativeMapUrl(
  urls: NativeMapUrls,
  navigatorLike: NavigatorLike | undefined = getBrowserNavigator(),
): string {
  if (!navigatorLike) {
    return urls.googleMapsUrl;
  }

  const platform = navigatorLike.platform.toLowerCase();
  const userAgent = navigatorLike.userAgent.toLowerCase();
  const isAppleDevice =
    /mac|iphone|ipad|ipod/.test(platform) ||
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === 'macintel' && navigatorLike.maxTouchPoints > 1);

  return isAppleDevice ? urls.appleMapsUrl : urls.googleMapsUrl;
}
