/* HyperDrive T8 R6 — F2 physical cars count as the assigned F1 constructors.
   RLT export files remain untouched; this normalisation affects display/scoring only.
   Format: one _qr6.json qualifying, one _r6_sprint.json, one _r6.json per division. */
(function (global) {
  'use strict';
  const SEASON=8,ROUND=6;
  const CONSTRUCTORS={
    'McLaren':{uniqueId:'mclaren.2026',fullName:'McLaren Formula 1 Team',abbreviation:'MCL',primaryColor:'#FFFF8000',secondaryColor:'#FF333333'},
    'Mercedes':{uniqueId:'mercedes.2026',fullName:'Mercedes-AMG Petronas F1 Team',abbreviation:'MER',primaryColor:'#FF27F4D2',secondaryColor:'#FFA3A3A3'},
    'Red Bull':{uniqueId:'red.bull.2026',fullName:'Oracle Red Bull Racing',abbreviation:'RB',primaryColor:'#FF3671C6',secondaryColor:'#FFE00008'},
    'Haas':{uniqueId:'haas.2026',fullName:'Haas F1 Team',abbreviation:'HAS',primaryColor:'#FFB6BABD',secondaryColor:'#FF333333'},
    'Alpine':{uniqueId:'alpine.2026',fullName:'BWT Alpine F1 Team',abbreviation:'ALP',primaryColor:'#FF0093CC',secondaryColor:'#FFFF87BC'},
    'Ferrari':{uniqueId:'ferrari.2026',fullName:'Scuderia Ferrari',abbreviation:'FER',primaryColor:'#FFE80020',secondaryColor:'#FFFFF200'},
    'Aston Martin':{uniqueId:'aston.martin.2026',fullName:'Aston Martin Aramco F1 Team',abbreviation:'AMR',primaryColor:'#FF229971',secondaryColor:'#FFCCF738'},
    'Cadillac':{uniqueId:'cadillac.2026',fullName:'Cadillac Formula One Team',abbreviation:'CAD',primaryColor:'#FF001E5F',secondaryColor:'#FFFFFFFF'},
    'Racing Bulls':{uniqueId:'racing.bulls.2026',fullName:'Visa Cash App Racing Bulls F1 Team',abbreviation:'VRB',primaryColor:'#FF6692FF',secondaryColor:'#FFFFFFFF'},
    'Williams':{uniqueId:'williams.2026',fullName:'Williams Racing',abbreviation:'WIL',primaryColor:'#FF64C4FF',secondaryColor:'#FF0D66D9'},
    'Audi':{uniqueId:'audi.2026',fullName:'Audi Formula One Team',abbreviation:'AUD',primaryColor:'#FFB4B4B4',secondaryColor:'#FF232323'}
  };
  const F2_ASSIGNMENTS=[
    ['Invicta Racing','McLaren'],
    ['Hitech TGR','Mercedes'],
    ['Campos Racing','Red Bull'],
    ['DAMS Lucas Oil','Haas'],
    ['MP Motorsport','Alpine'],
    ['PREMA Racing','Ferrari'],
    ['Rodin Motorsport','Aston Martin'],
    ['ART Grand Prix','Cadillac'],
    ['AIX Racing','Racing Bulls'],
    ['Van Amersfoort Racing','Williams'],
    ['Trident','Audi']
  ];
  const normalizeName=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const f2Map=new Map(F2_ASSIGNMENTS.map(([f2,f1])=>[normalizeName(f2),f1]));
  // Names may be abbreviated by RLT; make these explicit instead of
  // blindly replacing any unknown constructor with a guessed F1 team.
  [['Hitech','Mercedes'],['Hitech Grand Prix','Mercedes'],
   ['DAMS','Haas'],['DAMS Lucas Oil F2','Haas'],
   ['ART','Cadillac'],['Van Amersfoort','Williams'],
   ['PREMA','Ferrari'],['Invicta','McLaren'],
   ['Rodin','Aston Martin'],['AIX','Racing Bulls'],
   ['Campos','Red Bull'],['MP','Alpine']].forEach(([f2,f1])=>f2Map.set(normalizeName(f2),f1));

  const SPRINT_POINTS=[12,10,8,7,6,5,4,3,2,1];
  const RACE_POINTS=[25,20,16,13,11,10,9,8,7,6,5,4,3,2,1];
  function getF1Name(f2Team){return f2Map.get(normalizeName(f2Team))||null;}
  function carCategory(division,round,data) {
    if(Number(round)!==ROUND)return 'F1';
    const seasonName=String(data?.season?.seasonName||'');
    if(seasonName && /\d/.test(seasonName) && !seasonName.includes(String(SEASON)))return 'F1';
    const rltSeries=String(data?.season?.championshipName||'');
    const drivers=data?.session?.drivers||[];
    return /\bF2\b|formula\s*2/i.test(rltSeries) ||
      drivers.some(driver=>getF1Name(driver?.team?.name))?'F2':'F1';
  }
  function formatType(fileType,data){
    const arg=String(fileType||'').toLowerCase();
    if(arg.includes('qual'))return 'qualy';
    if(arg.includes('sprint'))return 'sprint';
    const info=data?.session?.sessionInfo||{};
    const session=String(info.sessionType||'').toLowerCase();
    if(session.includes('qual'))return 'qualy';
    if(String(info.raceType||'').toLowerCase().includes('sprint'))return 'sprint';
    return 'race';
  }
  function normalizeFile(data,division,round,fileType){
    if(!data || !Array.isArray(data?.session?.drivers) ||
       Number(round)!==ROUND || !['academy','hyperdrive'].includes(String(division)))return data;
    const category=carCategory(division,round,data);
    if(category!=='F2')return data;
    const sessionType=formatType(fileType,data);
    const original=data.session.drivers;
    const fastestKey=normalizeName(data.session.fastestLap?.driverName);
    const drivers=original.map(driver=>{
      const originalTeam=driver?.team?.name||driver?.teamName||'';
      const f1Team=getF1Name(originalTeam);
      const updated={...driver};
      if(f1Team){
        updated.f2TeamName=originalTeam;
        updated.team={...driver.team,...CONSTRUCTORS[f1Team],name:f1Team};
        if('teamName' in driver)updated.teamName=f1Team;
      }else if(originalTeam && !CONSTRUCTORS[originalTeam]){
        console.warn('F2 R6: escudería sin equivalencia F1:',originalTeam,driver.driverName);
      }
      const position=Number(driver.classificationPosition??driver.position);
      const finished=Number.isInteger(position)&&position>0 &&
          !/dsq|dnf|retired|disqual/i.test(String(driver.status||''));
      let points=0;
      if(sessionType==='race' && finished){
        points=RACE_POINTS[position-1]||0;
        if(points>0 && normalizeName(driver.driverName||driver.driverInfo?.displayName)===fastestKey)points++;
      }else if(sessionType==='sprint' && finished){
        points=SPRINT_POINTS[position-1]||0;
      }else if(sessionType==='qualy' && position===1){
        points=1;
      }
      updated.driverPoints=String(points);
      return updated;
    });
    return {...data,hyperdriveCarCategory:'F2',hyperdriveOfficialTeams:'F1',
      session:{...data.session,drivers}};
  }
  global.HyperDriveRoundSix=Object.freeze({
    round:ROUND,
    season:SEASON,
    assignments:Object.freeze(F2_ASSIGNMENTS.map(([f2,f1])=>Object.freeze({f2,f1}))),
    getF1Name,carCategory,normalizeFile
  });
})(window);
