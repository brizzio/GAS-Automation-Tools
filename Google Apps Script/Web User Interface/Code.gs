// Global error handler
function handleError(error) {
  Logger.log('Error occurred: ' + error.toString());
  return {
    success: false,
    error: error.toString()
  };
}

function getSpreadsheet() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    const spreadsheetId = scriptProps.getProperty('SPREADSHEET_ID');
    
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID not found in script properties');
    }
    
    const ss = SpreadsheetApp.openById(spreadsheetId);
    if (!ss) {
      throw new Error('Could not open spreadsheet with ID: ' + spreadsheetId);
    }
    
    return ss;
  } catch (error) {
    throw new Error('Failed to get spreadsheet: ' + error.toString());
  }
}

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Project Management System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Helper function to convert date objects to ISO strings
function serializeDate(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function getTasks() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Tasks');
    
    if (!sheet) {
      throw new Error('Tasks sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(header => header.toString().toLowerCase().trim());
    const tasks = [];

    // Define expected columns and their variations
    const columnMap = {
      id: ['id', 'taskid', 'task_id'],
      title: ['title', 'tasktitle', 'task_title', 'name'],
      description: ['description', 'desc', 'task_description'],
      status: ['status', 'taskstatus', 'task_status', 'state'],
      assignedTo: ['assignedto', 'assigned_to', 'assignee', 'owner'],
      projectId: ['projectid', 'project_id', 'project'],
      createdDate: ['createddate', 'created_date', 'date_created', 'created']
    };

    // Find column indices
    const columnIndices = {};
    for (const [key, variations] of Object.entries(columnMap)) {
      const index = variations.findIndex(v => headers.includes(v));
      if (index !== -1) {
        columnIndices[key] = headers.indexOf(variations[index]);
      }
    }

    Logger.log('Column mapping:', columnIndices);

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const task = {
        id: row[columnIndices.id] || `task-${i}`,
        title: row[columnIndices.title] || 'Untitled Task',
        description: row[columnIndices.description] || '',
        status: row[columnIndices.status] || 'New',
        assignedTo: row[columnIndices.assignedTo] || '',
        projectId: row[columnIndices.projectId] || '',
        createdDate: serializeDate(row[columnIndices.createdDate]) || new Date().toISOString()
      };
      tasks.push(task);
    }

    Logger.log('Successfully retrieved ' + tasks.length + ' tasks');
    return tasks; // Return tasks directly without wrapping
  } catch (error) {
    Logger.log('Error in getTasks: ' + error.toString());
    return []; // Return empty array on error
  }
}

function getProjects() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Projects');
    
    if (!sheet) {
      throw new Error('Projects sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(header => header.toString().toLowerCase().trim());
    const projects = [];

    // Define expected columns and their variations
    const columnMap = {
      id: ['id', 'projectid', 'project_id'],
      name: ['name', 'projectname', 'project_name', 'title'],
      description: ['description', 'desc', 'project_description'],
      startDate: ['startdate', 'start_date', 'started', 'begins'],
      endDate: ['enddate', 'end_date', 'due_date', 'deadline']
    };

    // Find column indices
    const columnIndices = {};
    for (const [key, variations] of Object.entries(columnMap)) {
      const index = variations.findIndex(v => headers.includes(v));
      if (index !== -1) {
        columnIndices[key] = headers.indexOf(variations[index]);
      }
    }

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const project = {
        id: row[columnIndices.id] || `project-${i}`,
        name: row[columnIndices.name] || 'Untitled Project',
        description: row[columnIndices.description] || '',
        startDate: serializeDate(row[columnIndices.startDate]) || '',
        endDate: serializeDate(row[columnIndices.endDate]) || ''
      };
      projects.push(project);
    }

    Logger.log('Successfully retrieved ' + projects.length + ' projects');
    return projects; // Return projects directly without wrapping
  } catch (error) {
    Logger.log('Error in getProjects: ' + error.toString());
    return []; // Return empty array on error
  }
}

function getUsers() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Users');
    
    if (!sheet) {
      throw new Error('Users sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(header => header.toString().toLowerCase().trim());
    const users = [];

    // Define expected columns and their variations
    const columnMap = {
      id: ['id', 'userid', 'user_id'],
      name: ['name', 'username', 'user_name', 'fullname'],
      email: ['email', 'emailaddress', 'email_address', 'mail']
    };

    // Find column indices
    const columnIndices = {};
    for (const [key, variations] of Object.entries(columnMap)) {
      const index = variations.findIndex(v => headers.includes(v));
      if (index !== -1) {
        columnIndices[key] = headers.indexOf(variations[index]);
      }
    }

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const user = {
        id: row[columnIndices.id] || `user-${i}`,
        name: row[columnIndices.name] || 'Unknown User',
        email: row[columnIndices.email] || ''
      };
      users.push(user);
    }

    Logger.log('Successfully retrieved ' + users.length + ' users');
    return users; // Return users directly without wrapping
  } catch (error) {
    Logger.log('Error in getUsers: ' + error.toString());
    return []; // Return empty array on error
  }
}

function addTask(taskData) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Tasks');
    
    if (!sheet) {
      throw new Error('Tasks sheet not found');
    }

    // Validate required fields
    if (!taskData.title || !taskData.status) {
      throw new Error('Title and status are required fields');
    }

    const newId = 'TASK-' + new Date().getTime();
    const createdDate = new Date(); // Keep as Date object for spreadsheet

    // Get headers to ensure correct column order
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = headers.map(header => {
      switch(header.toString().toLowerCase().trim()) {
        case 'id': return newId;
        case 'title': return taskData.title;
        case 'description': return taskData.description || '';
        case 'status': return taskData.status;
        case 'assignedto': return taskData.assignedTo || '';
        case 'projectid': return taskData.projectId || '';
        case 'createddate': return createdDate; // Store as Date object
        default: return '';
      }
    });

    sheet.appendRow(rowData);
    
    Logger.log('Successfully added new task with ID: ' + newId);
    return {
      success: true,
      message: 'Task added successfully',
      taskId: newId
    };
  } catch (error) {
    return handleError(error);
  }
}