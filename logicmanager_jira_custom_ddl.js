const generateSchema = async ({ event, previousWizardState, previousSlotState }) => {
    const logicmanagerEnum = await buildLogicManagerEnum(previousWizardState);
    const jiraIssueFieldsEnum = await fetchJiraIssueFields(previousWizardState);
      
    return {
        ...previousSlotState,
        status: 'VISIBLE',
        jsonSchema: {
            "title": "LogicManager to Jira Mapper",
            "default": [],
            "type": "array",
            "table": {
                "logicmanager_fields": "Logic Manager Fields",
                "jiracloud_fields": "Jira Cloud Fields"
            },
            "items": {
                "title": "LM <> Jira Mapper",
                "type": "object",
                "properties": {
                    "logicmanager_fields": {
                        "type": "string",
                        "title": "Logic Manager field",
                        "default": "",
                        "enum": logicmanagerEnum
                    },
                    "jiracloud_fields": {
                        "type": "string",
                        "title": "Jira Cloud field",
                        "default": "",
                        "enum": jiraIssueFieldsEnum
                    }
                },
                "default": {},
                "additionalItems": true,
                "additionalProperties": false
            }
        }
    };

  };

  const fetchJiraIssueFields = async (previousWizardState) => {
    const jiraAuthId = previousWizardState.values[tray.env.jiraCloudAuthId];
    // const projectKey = previousWizardState.values[tray.env.projectKey];
    // const issueTypeId = previousWizardState.values[tray.env.issueTypeId];
    // const endpoint = developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-createmeta-get/ -> get issue dynamically (tray connector also hard codes the static fields in the response)
    const endpoint = "/field";
    
    const inputData = {
        "headers": [
            {
                "key": "Authorization",
                "value": "Bearer {$auth.access_token}"
            }
        ],
        "url": {
		    "endpoint": endpoint
        },
        "status_code": {
            "range": {
            "from": 200,
            "to": 299
            }
        },
        "follow_redirect": false,
        "auth": {
            "none": null
        },
        "parse_response": "true",
        "reject_unauthorized": true,
        "include_raw_body": false,
        "body": {
            "none": null
        }
    };
  
    
      inputData["method"] = "GET";
      
      const unparsedResponse = await tray.callConnector({
        connector: "jira-cloud",
        version: "2.0",
        operation: "raw_http_request",
        input: inputData,
        authId: jiraAuthId
      });
  
      const fieldResponse = JSON.parse(unparsedResponse);
      const jira_issue_fieds = fieldResponse.response.body;
      return buildJiraIssueFieldsEnum(jira_issue_fieds);
  }

  const buildJiraIssueFieldsEnum = (fields) => {
    const dynamicJiraFields = fields.map(field =>  {
        console.log(field)
        return {
            text: field.name, 
            value: field.key
        }
    });
    const staticJiraFields = buildStaticJiraFields();
    return dynamicJiraFields.concat(staticJiraFields).sort((firstEl, secondEl) => (firstEl.text > secondEl.text ? 1 : -1));
  }

  const buildStaticJiraFields = () => {
      return [
          {
              text: "Project Key",
              value: "project_key"
          },
          {
            text: "Summary",
            value: "summary"
        },
        {
            text: "Issue Type Id",
            value: "issue_type_id"
        },
        {
            text: "Labels",
            value: "labels"
        },
        {
            text: "Description",
            value: "description"
        },
        {
            text: "Due Date",
            value: "due_date"
        },
        {
            text: "Assignee Key",
            value: "assignee_key"
        },
        {
            text: "Reporter Key",
            value: "reporter_key"
        },
        {
            text: "Priority Id",
            value: "priority_id"
        },
        {
            text: "Versions",
            value: "versions"
        },
        {
            text: "Fix Versions",
            value: "fix_versions"
        }
      ]
  }
  
  const buildLogicManagerEnum = async (previousWizardState) => {
      const logicmanagerAuthId = previousWizardState.values[tray.env.logicmanagerAuthId];
      const incidentTypeId = previousWizardState.values[tray.env.incidentTypeId];
      const url = "https://{$.auth.domain}.logicmanager.com/api/v1/incident-types/" + incidentTypeId;
    
      const inputData = {
      "headers": [
            {
                "key": "Api-Key",
                "value": "{$.auth.global_token}"
            }
        ],
        "status_code": {
          "range": {
            "from": 200,
            "to": 299
          }
        },
        "follow_redirect": false,
        "auth": {
          "basic_auth": {
            "username": "{$.auth.username}",
            "password": "{$.auth.password}"
          }
        },
        "parse_response": "true",
        "reject_unauthorized": true
      };
    
      
        inputData["url"] = url;
        const lm_issue_fields_enum = [];
        const unparsedResponse = await tray.callConnector({
          connector: "http-client",
          version: "5.0",
          operation: "get_request",
          input: inputData,
          authId: logicmanagerAuthId
        });
    
        const fieldResponse = JSON.parse(unparsedResponse);
        const lm_fields = fieldResponse.response.body.profile.tabs;
        lm_fields.forEach(tab => {
            tab.fields.forEach(field => {
                const obj = {text: null, value: null}
                obj.text = field.name;
                obj.value = field.key;
                lm_issue_fields_enum.push(obj);
            })
        });
        return lm_issue_fields_enum;
    }
  
  tray.on('CONFIG_SLOT_MOUNT', async ({ event, previousWizardState, previousSlotState }) => {
      
      // hide the field when the config screen first shows
      
      if (event.data.externalId === tray.env.slotExternalId && event.data.status === 'LOADING') {
  
          return await generateSchema({ event, previousWizardState, previousSlotState });
          
      } else if (event.data.externalId === tray.env.slotExternalId) {
          
        return {
          ...previousSlotState,
          status: 'HIDDEN',
          value: []
        };
          
      } else {
          return;
      }
      
  });
  
  tray.on('CONFIG_SLOT_VALUE_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
      console.log('CONFIG_SLOT_VALUE_CHANGED');
  
      const getValueOfDependent = event.data.value;
      
      // wait until the entity type has been selected before showing the field
      
      if (event.data.externalId === tray.env.entityTypeSlot && getValueOfDependent !== undefined && getValueOfDependent !== '') {
  
          return {
              ...previousSlotState, 
              status: 'LOADING'
          };
          
      } else {
          return;
      }
      
  });
  
  tray.on('CONFIG_SLOT_STATUS_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
  
      if (event.data.externalId === tray.env.slotExternalId && event.data.status === 'LOADING') {
  
          return await generateSchema({ event, previousWizardState, previousSlotState });
          
      } else {
  
          return;
          
      }
      
  });
  
  tray.on('AUTH_SLOT_VALUE_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    
    return {
              ...previousSlotState,
              status: 'LOADING'
      };
    
  });