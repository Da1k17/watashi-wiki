const { backend, MODEL } = require("./_llm");
module.exports = async (req, res) => res.status(200).json({ backend: backend(), model: MODEL });
