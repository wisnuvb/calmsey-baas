var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(stdin_exports);
async function handler(context) {
  try {
    const { prisma, log, error } = context;
    log("Fetching all users");
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    return {
      success: true,
      data: users,
      count: users.length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (err) {
    context.error("Failed to fetch users:", err.message);
    return {
      success: false,
      error: "Failed to retrieve user data",
      message: process.env.NODE_ENV === "development" ? err.message : void 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
