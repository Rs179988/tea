export function isParameterSegment(segment: string): boolean {
  if (/^\d+$/.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  if (/^usr_[a-zA-Z0-9]+$/.test(segment)) return true;
  if (/^ord_[a-zA-Z0-9]+$/.test(segment)) return true;
  if (/^item_[a-zA-Z0-9]+$/.test(segment)) return true;
  return false;
}

export function clusterPathname(pathname: string): { routePattern: string; pathParams: string[] } {
  const parts = pathname.split('/').filter(Boolean);
  const pathParams: string[] = [];

  const parameterized = parts.map((seg, idx) => {
    if (isParameterSegment(seg)) {
      const prev = idx > 0 ? parts[idx - 1] : 'item';
      const singular = prev.endsWith('ies')
        ? prev.slice(0, -3) + 'y'
        : prev.endsWith('s')
        ? prev.slice(0, -1)
        : prev;
      const paramName = `${singular}Id`;
      pathParams.push(paramName);
      return `{${paramName}}`;
    }
    return seg;
  });

  return {
    routePattern: '/' + parameterized.join('/'),
    pathParams,
  };
}
