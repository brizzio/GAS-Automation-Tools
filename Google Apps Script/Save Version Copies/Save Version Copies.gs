function versionThisScript() {
  const note = 'dev deployment 1'

  const props = PropertiesService.getScriptProperties();
  let versionNum = parseInt(props.getProperty("VERSION_NUMBER") || "0", 10) + 1;
  props.setProperty("VERSION_NUMBER", versionNum.toString());

  const thisScriptId = ScriptApp.getScriptId();
  const thisScriptFile = DriveApp.getFileById(thisScriptId);
  const currentName = thisScriptFile.getName();
  
  // Find versions folder in parent directory
  const parentFolders = thisScriptFile.getParents();
  let versionsFolder = null;
  while (parentFolders.hasNext()) {
    const parent = parentFolders.next();
    const subFolders = parent.getFolders();
    while (subFolders.hasNext()) {
      const folder = subFolders.next();
      if (folder.getName().toLowerCase() === 'versions') {
        versionsFolder = folder;
        break;
      }
    }
    if (versionsFolder) break;
  }
  
  if (!versionsFolder) {
    throw new Error('No "versions" folder found in script parent directory');
  }

  const noteText = note ? ` - ${note}` : '';
  const newName = `${currentName} v${versionNum}${noteText}`;
  const copy = thisScriptFile.makeCopy(newName);
  copy.moveTo(versionsFolder);

  Logger.log(`Created copy: "${copy.getName()}" in versions folder`);
}

//versionThisScript();  // No note
//versionThisScript("fixed bug");  // Adds note to version name