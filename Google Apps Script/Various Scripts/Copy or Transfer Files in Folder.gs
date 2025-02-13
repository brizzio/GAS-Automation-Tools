//=============================================
// Make sure the "Drive" service is enabled
//=============================================

/**
 * Copies *everything* in the parent folder into a "Copies" folder,
 * including standalone Apps Script files. Uses Drive.Files.copy(...), 
 * then moveTo(...) and setName(...) to ensure the new script appears 
 * in the folder with the same name (no "Copy of" prefix).
 */
function copyAllParentContentsIntoCopies() {
  // Retrieve PARENT_FOLDER_ID from Script Properties
  var scriptProperties = PropertiesService.getScriptProperties();
  var parentFolderId = scriptProperties.getProperty("PARENT_FOLDER_ID");
  if (!parentFolderId) {
    Logger.log("Error: 'PARENT_FOLDER_ID' is not set in Script Properties.");
    return;
  }

  Logger.log("Starting copy process for parent folder ID: %s", parentFolderId);
  var parentFolder = DriveApp.getFolderById(parentFolderId);
  Logger.log("Parent folder name: " + parentFolder.getName());

  var copiesFolder = getOrCreateFolderByName(parentFolder, "Copies");
  Logger.log('Using/created "Copies" folder: ' + copiesFolder.getName());

  copySubfoldersAndFiles(parentFolder, copiesFolder);

  Logger.log("Copy process completed.");
}

function copySubfoldersAndFiles(source, destination) {
  Logger.log("Copying contents of folder: %s --> %s", source.getName(), destination.getName());

  // Copy all files
  var files = source.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    Logger.log("  Found file: " + file.getName());
    copyFileOrScript(file, destination);
  }

  // Copy all subfolders
  var folders = source.getFolders();
  while (folders.hasNext()) {
    var subfolder = folders.next();
    var subfolderName = subfolder.getName();

    // Avoid infinite recursion if the "Copies" folder is inside the same parent
    if (subfolderName === "Copies") {
      Logger.log("  SKIPPING folder 'Copies' to avoid infinite loop.");
      continue;
    }

    Logger.log("  Creating subfolder: " + subfolderName + " under " + destination.getName());
    var newSubfolder = destination.createFolder(subfolderName);

    Logger.log("    Subfolder created. Recursively copying contents of %s", subfolderName);
    copySubfoldersAndFiles(subfolder, newSubfolder);
  }

  Logger.log("Finished copying folder: " + source.getName());
}

/**
 * Copies a single file. If it's a standalone Apps Script, uses the Drive API,
 * then renames it to remove the "Copy of" prefix, and moves it to the destination folder.
 */
function copyFileOrScript(file, destination) {
  var mimeType = file.getMimeType();
  var originalName = file.getName();

  if (mimeType === "application/vnd.google-apps.script") {
    Logger.log("    -> Detected Apps Script. Using Drive.Files.copy().");

    // Build the resource for copying
    var resource = {
      title: originalName,
      mimeType: mimeType,
      parents: [
        { 
          kind: "drive#parentReference", 
          id: destination.getId()
        }
      ]
    };

    // If using a shared drive, include {supportsAllDrives: true}:
    // var copyOptions = { supportsAllDrives: true };
    var newFile = Drive.Files.copy(resource, file.getId()); // , copyOptions);

    // Now forcibly move and rename it so it shows up in the UI with the correct title
    var movedFile = DriveApp.getFileById(newFile.id);
    movedFile.moveTo(destination);
    movedFile.setName(originalName); // <-- Force the name we want!
    Logger.log("    Copied Apps Script '%s' to folder: %s", originalName, destination.getName());
  } else {
    // For all other file types, makeCopy() retains the original name by default
    Logger.log("    -> Using makeCopy for: " + originalName);
    file.makeCopy(originalName, destination);
  }
}

/**
 * Returns an existing folder named `folderName` within `parent`, or creates it if missing.
 */
function getOrCreateFolderByName(parent, folderName) {
  Logger.log('Searching for folder "%s" under: %s', folderName, parent.getName());
  var folders = parent.getFoldersByName(folderName);
  if (folders.hasNext()) {
    var found = folders.next();
    Logger.log('  Found existing folder: ' + found.getName());
    return found;
  } else {
    Logger.log('  Creating folder: ' + folderName);
    return parent.createFolder(folderName);
  }
}
