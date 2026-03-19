const isEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};
const isUsername = (value) => {
  return /^[a-zA-Z0-9_]+$/.test(value);
};

export { isEmail, isUsername };
