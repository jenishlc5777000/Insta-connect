/**
 * Validates req[source] with a Zod schema and replaces it with the parsed (coerced, stripped) value.
 */
const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) return next(result.error);
    if (source === 'query') {
      Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true, enumerable: true });
    } else {
      req[source] = result.data;
    }
    return next();
  };

module.exports = validate;
