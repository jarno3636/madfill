static async getInitialProps(ctx) {
  const initialProps = await Document.getInitialProps(ctx)
  return {
    ...initialProps,
    styles: Array.isArray(initialProps.styles)
      ? initialProps.styles
      : initialProps.styles
        ? [initialProps.styles]
        : [],
  }
}
