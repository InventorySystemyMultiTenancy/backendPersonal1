const { AsyncLocalStorage } = require("node:async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

function requestContextMiddleware(req, _res, next) {
  const store = {
    auth: req.auth || null,
  };

  asyncLocalStorage.run(store, () => next());
}

function setAuthContext(auth) {
  const store = asyncLocalStorage.getStore();

  if (store) {
    store.auth = auth;
  }
}

function getAuthContext() {
  const store = asyncLocalStorage.getStore();
  return store ? store.auth : null;
}

module.exports = {
  requestContextMiddleware,
  setAuthContext,
  getAuthContext,
};
