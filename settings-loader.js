(async function(){

const SHEET_ID="1wDHuoi8_cpGx0wYemSWE86Oxwiz9_QIUAVNxUAhAk8A";

try{

const url=
`https://opensheet.elk.sh/${SHEET_ID}/SETTINGS`;

const rows=
await fetch(url)
.then(r=>r.json());

const settings={};

rows.forEach(r=>{

const key=
String(
r.Key||''
)
.trim()
.toLowerCase();

const value=
String(
r.Value||''
)
.trim()
.toUpperCase();

settings[key]=
value==="Y";

});

const map={

timeline:"Timeline",
slot:"Explore / Slot",
photos:"Photos",
cards:"Cards",
field:"Field",
flow:"Flow",
sphere:"Sphere",
geodesic:"Geodesic",
about:"About"

};

Object.entries(map)
.forEach(
([key,label])=>{

if(
settings[key]===false
){

const buttons=
[...document.querySelectorAll(
"button"
)];

buttons
.filter(
b=>
b.textContent
.trim()
===label
)
.forEach(
b=>b.remove()
);

}

});

console.log(
"Dome settings loaded",
settings
);

}catch(e){

console.log(
"SETTINGS load failed",
e
);

}

})();