async function processStaffData(filePath) {
  return { inserted: 0, updated: 0, errors: [] };
}

async function processUrlImport(url) {
  return { inserted: 0, updated: 0, errors: [] };
}

module.exports = { processStaffData, processUrlImport };
