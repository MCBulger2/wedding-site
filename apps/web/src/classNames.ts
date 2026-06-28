export function cx(
  ...classNames: Array<string | false | null | undefined>
): string {
  return classNames.filter(Boolean).join(' ');
}

export function scoped(
  styles: Record<string, string>,
  className: string,
): string {
  return cx(styles[className], className);
}
