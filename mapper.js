exports.step = function (input) {
  let mappings = input.jiraMapper;
  const result = [];
  for (let i = 0; i < mappings.length - 1; i++) {
    const mapping = mappings[i];
    if (!input.Incident[mapping.logicmanager_fields]) continue;
    result.push({
      name: mapping.jiracloud_fields,
      value: input.Incident[mapping.logicmanager_fields].data
    });
  }
  return result;
};