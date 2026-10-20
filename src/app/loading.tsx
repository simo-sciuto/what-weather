/**
 * What shows while a route's content streams (the labs, and the atlas before its shell): the sky, empty. With Cache
 * Components this boundary is also what lets a page that reads the request be prerendered around it.
 */
export default function Loading() {
  return <div aria-busy="true" className="atmosphere h-dvh w-full" />;
}
