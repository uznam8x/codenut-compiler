const nut = [];
module.exports = {
  register: (name, opts) => {
    nut[name] = opts;
  },
  get: (name) => {
    if (name) return nut[name];
    return nut;
  }
}