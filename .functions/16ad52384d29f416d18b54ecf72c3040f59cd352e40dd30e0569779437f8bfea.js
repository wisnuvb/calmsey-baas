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

// <stdin>
var stdin_exports = {};
__export(stdin_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(stdin_exports);
async function handler(context) {
  const { prisma, request, project, log } = context;
  log("Function invoked with payload:", request.body);
  const collectionSlug = "quis-app";
  const tableName = `data_${project.slug}_${collectionSlug}`;
  try {
    const data = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${tableName}" LIMIT 10`
    );
    return {
      success: true,
      message: `Fetched ${data.length} items from ${tableName}`,
      data,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    log("Error fetching data:", error.message);
    return {
      success: false,
      error: `Failed to fetch from ${tableName}. Make sure the collection exists.`,
      details: error.message
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
