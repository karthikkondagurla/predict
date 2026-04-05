import dotenv from 'dotenv';
dotenv.config();
const key = "282ed8dd-1ed5-4183-a890-b117720f2843";
fetch(`https://api.cricapi.com/v1/series_info?apikey=${key}&id=87c62aac-bc3c-4738-ab93-19da0690488f`)
.then(res => res.json())
.then(data => {
  if(data.data && data.data.matchList) {
    const dates = data.data.matchList.map(m => m.dateTimeGMT);
    console.log(dates.filter(d => d.includes('2026-04-06') || d.includes('2026-04-05') || d.includes('2026-04-07')));
  } else {
    console.log(data);
  }
});
