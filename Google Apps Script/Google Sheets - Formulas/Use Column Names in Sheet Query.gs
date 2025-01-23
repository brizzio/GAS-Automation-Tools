//These functions were found online at the resources below: 
//https://support.google.com/docs/thread/179627889/use-column-names-in-sheets-query?hl=en
//https://www.youtube.com/watch?v=clq7WlC2whk

function MYSELECT(sqlstring,headersrange) {
  
  // "Select [name], [salary], [dept]  where [salary] > 500 "
  let text = sqlstring
  let headers = headersrange[0]
  
  let results = text.matchAll(/\[.*?\]/g)
  let matches = [...results].map(match => match[0])
  // [name], [salary], [dept], [salary]
  let uniqueMatches = [...new Set(matches)]
  //console.log(uniqueMatches)
  // [name], [salary], [dept]
  let pos
  let regextext
  uniqueMatches.forEach(match=>{
  //console.log(match)
     
  pos = headers.indexOf(match.slice(1,-1))
  //console.log(pos)
  if(pos !== -1){
    regextext = `\\[${match.slice(1,-1)}\\]`
    console.log(regextext)
    text = text.replace(new RegExp(regextext,"g"),`Col${pos+1}`)
  }
                        
  })
  
  return text           
}
  
//=QUERY({qdata!A1:H},MYSELECT("Select [name], [salary], [age], [dept], [isSenior] where [salary] > 500",qdata!A1:H1),1) 
//=QUERY({'TAB NAME'!$A:P}, MYSELECT("Select [TASK], [DESCRIPTION] where [DUE DATE] = '"&H1&"'",'TAB NAME'!$A$1:P$1),1)

function textfunction(){
  
  let text = "Select [name], [salary], [dept]  where [salary] > 500 "
  
  let results = text.matchAll(/\[.*?\]/g)
  
  let matches = [...results]
                     
  let currentMatch = matches[0]
  let word = currentMatch[0]
  let columnName = word.slice(1,-1)
  let position = currentMatch["index"]
  
  text.replace(/\[name\]/g,"Col1")
  console.log(columnName)

}