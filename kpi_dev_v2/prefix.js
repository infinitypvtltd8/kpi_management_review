/* Single-file BI dashboard: public Google Sheet data is fetched at runtime.
   No passwords, access tokens, or personnel records are embedded in this file. */
const SHEET_BASE='https://docs.google.com/spreadsheets/d/e/2PACX-1vRM1HUPM1oAFn8z4omtD_OSPqYIAThpZypwjh32h1t0eqIdaX_XgsUmUEGj-wTcbWvaRsujAWBjXuyS/pub';
const LOGOS={apeiro:'@@APEIRO_LOGO@@',xguard:'@@XGUARD_LOGO@@'};
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const EMPLOYEES=[
 {id:'sumudu',name:'Sumudu',avatar:'SU',company:'apeiro',dept:'Operations',role:'Operations',gid:'2075064548',layout:'sumudu'},
 {id:'heshani',name:'Heshani',avatar:'HE',company:'apeiro',dept:'Operations',role:'Operations',gid:'524146754',layout:'heshani'},
 {id:'steve',name:'Steve',avatar:'ST',company:'apeiro',dept:'Operations',role:'Operations',gid:'0',layout:'steve'},
 {id:'dewapriya',name:'Dewapriya',avatar:'DW',company:'xguard',dept:'Operations',role:'Executive Officer',gid:'2041234844',layout:'operations',kpiDept:'Operations'},
 {id:'malintha',name:'Malintha',avatar:'ML',company:'xguard',dept:'Operations',role:'Executive Officer',gid:'1698747401',layout:'operations',kpiDept:'Operations'},
 {id:'geeth',name:'Geeth',avatar:'GE',company:'xguard',dept:'Admin',role:'Admin',gid:'1700505898',layout:'admin',kpiDept:'Admin'},
 {id:'uthpala',name:'Uthpala Chandrasekara',avatar:'UC',company:'xguard',dept:'Admin / HR & Recruitment',role:'Admin / HR & Recruitment',gid:'1364928466',layout:'recruitment',kpiDept:'HR & Recruitment'},
 {id:'ramal',name:'Ramal',avatar:'RA',company:'xguard',dept:'HR & Recruitment',role:'HR & Recruitment',gid:'1523144763',layout:'ramal',kpiDept:'HR & Recruitment'},
 {id:'ravira',name:'Ravira',avatar:'RV',company:'xguard',dept:'Finance',role:'Finance',gid:'446762719',layout:'finance',kpiDept:'Finance'},
 {id:'nimmi',name:'Nimmi',avatar:'NI',company:'xguard',dept:'Leadership / cross-department',role:'Head of Admin, HR & Recruitment and Finance',gid:'441945496',layout:'head',kpiDept:null}
];
const COMPANIES={
 apeiro:{name:'APEIRO',color:'#2758dc',subtitle:'Operations, project workstreams and individual performance.'},
 xguard:{name:'X GUARD',color:'#d7a30a',subtitle:'Operations, Admin, HR & Recruitment, Finance and leadership.'}
};
const DEPARTMENTS=[
 {name:'Operations',head:'—',memberIds:['dewapriya','malintha']},
 {name:'Admin',head:'Nimmi',memberIds:['geeth','uthpala']},
 {name:'HR & Recruitment',head:'Nimmi',memberIds:['uthpala','ramal']},
 {name:'Finance',head:'Nimmi',memberIds:['ravira']},
 {name:'Leadership & shared',head:'Nimmi',memberIds:['nimmi'],shared:true}
];
// Review groups use the role structure supplied by the user. They are not
// claims about a separate "unit" field in the source spreadsheet.
const UNITS={
 apeiro:[{id:'apeiro-ops',name:'Operations team',dept:'Operations',members:['sumudu','heshani','steve']}],
 xguard:[
  {id:'executive-officers',name:'Executive officers',dept:'Operations',members:['dewapriya','malintha']},
  {id:'admin-team',name:'Administration',dept:'Admin',members:['geeth']},
  {id:'recruitment-team',name:'Recruitment',dept:'HR & Recruitment',members:['uthpala','ramal']},
  {id:'finance-team',name:'Finance',dept:'Finance',members:['ravira']},
  {id:'leadership-team',name:'Cross-department leadership',dept:'Leadership & shared',members:['nimmi']}
 ]
};
const state={currentCompany:null,periodByCompany:{apeiro:null,xguard:null},selectedDepartment:'all',selectedEmployee:'all',selectedUnit:'all',tableSearch:'',tableStatus:'all',activeTab:'overview',records:Object.fromEntries(EMPLOYEES.map(e=>[e.id,[]])),source:Object.fromEntries(EMPLOYEES.map(e=>[e.id,{status:'loading',lastSuccess:null}])),refreshing:false,lastChecked:null};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const text=value=>String(value??'').trim();
const byId=id=>EMPLOYEES.find(e=>e.id===id);
const peopleFor=company=>EMPLOYEES.filter(e=>e.company===company);
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
function numberText(value,digits=1){return Number.isFinite(value)?Number(value.toFixed(digits)).toLocaleString(): '—';}
function pctText(value,digits=1){return Number.isFinite(value)?`${numberText(value,digits)}%`:'—';}
