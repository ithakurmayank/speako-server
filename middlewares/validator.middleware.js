const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!result.success) {
    return next(result.error);
  }

  if (result.data.body !== undefined) {
    req.body = result.data.body; // ✅ allowed
  }

  if (result.data.params !== undefined) {
    Object.assign(req.params, result.data.params); // ✅ mutate
  }

  if (result.data.query !== undefined) {
    Object.assign(req.query, result.data.query); // ✅ mutate
  }
  next();
};

export { validate };
