// SHARED COPY of COMBAT_CALC/combat_rules.js: edit the master there, then run TOOLS/sync_lib.py
/* Combat rules for AD&D 1e (RAW), DOM-free. Master copy: COMBAT_CALC. Shared to other apps by TOOLS/sync_lib.py.
   Loaded as a plain script by iron-wheel.html; test/combat.test.js loads it with vm. */
// ==== RULES:BEGIN (DOM-free: test/combat.test.js loads this block with vm) ====
// Data below is generated from the book text by test/parse_book.py + test/gen_rules_data.py and re-checked by the test.
var RULES_DATA = {matrix:{
 IA:{title:"I.A Clerics, Druids, Monks",cols:["1-3","4-6","7-9","10-12","13-15","16-18","19+"],rows:{
  "-10":[25,23,21,20,20,20,19],
  "-9":[24,22,20,20,20,19,18],
  "-8":[23,21,20,20,20,18,17],
  "-7":[22,20,20,20,19,17,16],
  "-6":[21,20,20,20,18,16,15],
  "-5":[20,20,20,19,17,15,14],
  "-4":[20,20,20,18,16,14,13],
  "-3":[20,20,19,17,15,13,12],
  "-2":[20,20,18,16,14,12,11],
  "-1":[20,19,17,15,13,11,10],
  "0":[20,18,16,14,12,10,9],
  "1":[19,17,15,13,11,9,8],
  "2":[18,16,14,12,10,8,7],
  "3":[17,15,13,11,9,7,6],
  "4":[16,14,12,10,8,6,5],
  "5":[15,13,11,9,7,5,4],
  "6":[14,12,10,8,6,4,3],
  "7":[13,11,9,7,5,3,2],
  "8":[12,10,8,6,4,2,1],
  "9":[11,9,7,5,3,1,0],
  "10":[10,8,6,4,2,0,-1]}},
 IB:{title:"I.B Fighters, Paladins, Rangers, Bards, 0 level",cols:["0","1-2","3-4","5-6","7-8","9-10","11-12","13-14","15-16","17+"],rows:{
  "-10":[26,25,23,21,20,20,20,18,16,14],
  "-9":[25,24,22,20,20,20,19,17,15,13],
  "-8":[24,23,21,20,20,20,18,16,14,12],
  "-7":[23,22,20,20,20,19,17,15,13,11],
  "-6":[22,21,20,20,20,18,16,14,12,10],
  "-5":[21,20,20,20,19,17,15,13,11,9],
  "-4":[20,20,20,20,18,16,14,12,10,8],
  "-3":[20,20,20,19,17,15,13,11,9,7],
  "-2":[20,20,20,18,16,14,12,10,8,6],
  "-1":[20,20,19,17,15,13,11,9,7,5],
  "0":[20,20,18,16,14,12,10,8,6,4],
  "1":[20,19,17,15,13,11,9,7,5,3],
  "2":[19,18,16,14,12,10,8,6,4,2],
  "3":[18,17,15,13,11,9,7,5,3,1],
  "4":[17,16,14,12,10,8,6,4,2,0],
  "5":[16,15,13,11,9,7,5,3,1,-1],
  "6":[15,14,12,10,8,6,4,2,0,-2],
  "7":[14,13,11,9,7,5,3,1,-1,-3],
  "8":[13,12,10,8,6,4,2,0,-2,-4],
  "9":[12,11,9,7,5,3,1,-1,-3,-5],
  "10":[11,10,8,6,4,2,0,-2,-4,-6]}},
 IC:{title:"I.C Magic-Users, Illusionists",cols:["1-5","6-10","11-15","16-20","21+"],rows:{
  "-10":[26,24,21,20,20],
  "-9":[25,23,20,20,20],
  "-8":[24,22,20,20,19],
  "-7":[23,21,20,20,18],
  "-6":[22,20,20,19,17],
  "-5":[21,20,20,18,16],
  "-4":[20,20,20,17,15],
  "-3":[20,20,19,16,14],
  "-2":[20,20,18,15,13],
  "-1":[20,20,17,14,12],
  "0":[20,19,16,13,11],
  "1":[20,18,15,12,10],
  "2":[19,17,14,11,9],
  "3":[18,16,13,10,8],
  "4":[17,15,12,9,7],
  "5":[16,14,11,8,6],
  "6":[15,13,10,7,5],
  "7":[14,12,9,6,4],
  "8":[13,11,8,5,3],
  "9":[12,10,7,4,2],
  "10":[11,9,6,3,1]}},
 ID1:{title:"I.D.1 Thieves, Assassins",cols:["1-4","5-8","9-12","13-16","17-20","21+"],rows:{
  "-10":[26,24,21,20,20,20],
  "-9":[25,23,20,20,20,19],
  "-8":[24,22,20,20,20,18],
  "-7":[23,21,20,20,19,17],
  "-6":[22,20,20,20,18,16],
  "-5":[21,20,20,19,17,15],
  "-4":[20,20,20,18,16,14],
  "-3":[20,20,19,17,15,13],
  "-2":[20,20,18,16,14,12],
  "-1":[20,20,17,15,13,11],
  "0":[20,19,16,14,12,10],
  "1":[20,18,15,13,11,9],
  "2":[19,17,14,12,10,8],
  "3":[18,16,13,11,9,7],
  "4":[17,15,12,10,8,6],
  "5":[16,14,11,9,7,5],
  "6":[15,13,10,8,6,4],
  "7":[14,12,9,7,5,3],
  "8":[13,11,8,6,4,2],
  "9":[12,10,7,5,3,1],
  "10":[11,9,6,4,2,0]}},
 II:{title:"II Monsters (by Hit Dice)",cols:["up to 1-1","1-1","1","1+","2-3+","4-5+","6-7+","8-9+","10-11+","12-13+","14-15+","16+"],rows:{
  "-10":[26,25,24,23,21,20,20,20,20,19,18,17],
  "-9":[25,24,23,22,20,20,20,20,19,18,17,16],
  "-8":[24,23,22,21,20,20,20,20,18,17,16,15],
  "-7":[23,22,21,20,20,20,20,19,17,16,15,14],
  "-6":[22,21,20,20,20,20,19,18,16,15,14,13],
  "-5":[21,20,20,20,20,20,18,17,15,14,13,12],
  "-4":[20,20,20,20,20,19,17,16,14,13,12,11],
  "-3":[20,20,20,20,19,18,16,15,13,12,11,10],
  "-2":[20,20,20,20,18,17,15,14,12,11,10,9],
  "-1":[20,20,20,19,17,16,14,13,11,10,9,8],
  "0":[20,20,19,18,16,15,13,12,10,9,8,7],
  "1":[20,19,18,17,15,14,12,11,9,8,7,6],
  "2":[19,18,17,16,14,13,11,10,8,7,6,5],
  "3":[18,17,16,15,13,12,10,9,7,6,5,4],
  "4":[17,16,15,14,12,11,9,8,6,5,4,3],
  "5":[16,15,14,13,11,10,8,7,5,4,3,2],
  "6":[15,14,13,12,10,9,7,6,4,3,2,1],
  "7":[14,13,12,11,9,8,6,5,3,2,1,0],
  "8":[13,12,11,10,8,7,5,4,2,1,0,-1],
  "9":[12,11,10,9,7,6,4,3,1,0,-1,-2],
  "10":[11,10,9,8,6,5,3,2,0,-1,-2,-3]}}
},
weapons:[
 {"name":"Axe, Battle","kind":"melee","spd":7,"spdTxt":"7","len":"c. 4’","space":"4’","adj":[-3,-1,1,-1,0,0,1,1,2],"sm":[1,8,0],"lg":[1,4,0],"smTxt":"1-8","lgTxt":"1-4"},
 {"name":"Axe, Hand","kind":"melee","spd":4,"spdTxt":"4","len":"c. 1½’","space":"1’","adj":[-3,-2,-2,-1,0,0,1,1,1],"sm":[1,6,0],"lg":[1,4,0],"smTxt":"1-6","lgTxt":"1-4"},
 {"name":"Bardiche","kind":"melee","spd":9,"spdTxt":"9","len":"c. 5’","space":"5’","adj":[-2,-1,0,0,1,1,2,2,3],"sm":[2,4,0],"lg":[3,4,0],"smTxt":"2-8","lgTxt":"3-12"},
 {"name":"Bec de Corbin","kind":"melee","spd":9,"spdTxt":"9","len":"c. 6’","space":"6’","adj":[2,2,2,0,0,0,0,0,-1],"sm":[1,8,0],"lg":[1,6,0],"smTxt":"1-8","lgTxt":"1-6"},
 {"name":"Bill-Guisarme","kind":"melee","spd":10,"spdTxt":"10","len":"8’+","space":"2’","adj":[0,0,0,0,0,0,1,0,0],"sm":[2,4,0],"lg":[1,10,0],"smTxt":"2-8","lgTxt":"1-10"},
 {"name":"Bo Stick","kind":"melee","spd":3,"spdTxt":"3","len":"c. 5’","space":"3’","adj":[-9,-7,-5,-3,-1,0,1,0,3],"sm":[1,6,0],"lg":[1,3,0],"smTxt":"1-6","lgTxt":"1-3"},
 {"name":"Club","kind":"melee","spd":4,"spdTxt":"4","len":"c. 3’","space":"1’-3’","adj":[-5,-4,-3,-2,-1,-1,0,0,1],"sm":[1,6,0],"lg":[1,3,0],"smTxt":"1-6","lgTxt":"1-3"},
 {"name":"Dagger","kind":"melee","spd":2,"spdTxt":"2","len":"c. 15”","space":"1’","adj":[-3,-3,-2,-2,0,0,1,1,3],"sm":[1,4,0],"lg":[1,3,0],"smTxt":"1-4","lgTxt":"1-3"},
 {"name":"Fauchard","kind":"melee","spd":8,"spdTxt":"8","len":"8’+","space":"2’","adj":[-2,-2,-1,-1,0,0,0,-1,-1],"sm":[1,6,0],"lg":[1,8,0],"smTxt":"1-6","lgTxt":"1-8"},
 {"name":"Fauchard-Fork","kind":"melee","spd":8,"spdTxt":"8","len":"8’","space":"2’","adj":[-1,-1,-1,0,0,0,1,0,1],"sm":[1,8,0],"lg":[1,10,0],"smTxt":"1-8","lgTxt":"1-10"},
 {"name":"Fist or Open Hand","kind":"melee","spd":1,"spdTxt":"1","len":"2’+","space":"-","adj":[-7,-5,-3,-1,0,0,2,0,4],"sm":null,"lg":null,"smTxt":null,"lgTxt":null},
 {"name":"Flail, Footman’s","kind":"melee","spd":7,"spdTxt":"7","len":"c. 4’","space":"6’","adj":[2,2,1,2,1,1,1,1,-1],"sm":[1,6,1],"lg":[2,4,0],"smTxt":"2-7","lgTxt":"2-8"},
 {"name":"Flail, Horseman’s","kind":"melee","spd":6,"spdTxt":"6","len":"c. 2’","space":"4’","adj":[0,0,0,0,0,1,1,1,0],"sm":[1,4,1],"lg":[1,4,1],"smTxt":"2-5","lgTxt":"2-5"},
 {"name":"Fork, Military","kind":"melee","spd":7,"spdTxt":"7","len":"7’+","space":"1’","adj":[-2,-2,1,0,0,1,1,0,1],"sm":[1,8,0],"lg":[2,4,0],"smTxt":"1-8","lgTxt":"2-8"},
 {"name":"Glaive","kind":"melee","spd":8,"spdTxt":"8","len":"8’+","space":"1’","adj":[-1,-1,0,0,0,0,0,0,0],"sm":[1,6,0],"lg":[1,10,0],"smTxt":"1-6","lgTxt":"1-10"},
 {"name":"Glaive-Guisarme","kind":"melee","spd":9,"spdTxt":"9","len":"8’+","space":"1’","adj":[-1,-1,0,0,0,0,0,0,0],"sm":[2,4,0],"lg":[2,6,0],"smTxt":"2-8","lgTxt":"2-12"},
 {"name":"Guisarme","kind":"melee","spd":8,"spdTxt":"8","len":"6’+","space":"2’","adj":[-2,-2,-1,-1,0,0,0,-1,-1],"sm":[2,4,0],"lg":[1,8,0],"smTxt":"2-8","lgTxt":"1-8"},
 {"name":"Guisarme-Voulge","kind":"melee","spd":10,"spdTxt":"10","len":"7’+","space":"2’","adj":[-1,-1,0,1,1,1,0,0,0],"sm":[2,4,0],"lg":[2,4,0],"smTxt":"2-8","lgTxt":"2-8"},
 {"name":"Halberd","kind":"melee","spd":9,"spdTxt":"9","len":"5’+","space":"5’","adj":[1,1,1,2,2,2,1,1,0],"sm":[1,10,0],"lg":[2,6,0],"smTxt":"1-10","lgTxt":"2-12"},
 {"name":"Hammer, Lucern","kind":"melee","spd":9,"spdTxt":"9","len":"5’+","space":"5’","adj":[1,1,2,2,2,1,1,0,0],"sm":[2,4,0],"lg":[1,6,0],"smTxt":"2-8","lgTxt":"1-6"},
 {"name":"Hammer","kind":"melee","spd":4,"spdTxt":"4","len":"c. 1½’","space":"2’","adj":[0,1,0,1,0,0,0,0,0],"sm":[1,4,1],"lg":[1,4,0],"smTxt":"2-5","lgTxt":"1-4"},
 {"name":"Jo Stick","kind":"melee","spd":2,"spdTxt":"2","len":"c. 3’","space":"2’","adj":[-8,-6,-4,-2,-1,0,1,0,2],"sm":[1,6,0],"lg":[1,4,0],"smTxt":"1-6","lgTxt":"1-4"},
 {"name":"Lance (heavy horse)","kind":"melee","spd":8,"spdTxt":"8","len":"c. 14’","space":"1’","adj":[3,3,2,2,2,1,1,0,0],"sm":[3,3,0],"lg":[3,6,0],"smTxt":"3-9","lgTxt":"3-18"},
 {"name":"Lance (light horse)","kind":"melee","spd":7,"spdTxt":"7","len":"10’","space":"1’","adj":[-2,-2,-1,0,0,0,0,0,0],"sm":[1,6,0],"lg":[1,8,0],"smTxt":"1-6","lgTxt":"1-8"},
 {"name":"Lance (medium horse)","kind":"melee","spd":6,"spdTxt":"6","len":"12’","space":"1’","adj":[0,1,1,1,1,0,0,0,0],"sm":[1,6,1],"lg":[2,6,0],"smTxt":"2-7","lgTxt":"2-12"},
 {"name":"Mace, Footman’s","kind":"melee","spd":7,"spdTxt":"7","len":"c. 2½’","space":"4’","adj":[1,1,0,0,0,0,0,1,-1],"sm":[1,6,1],"lg":[1,6,0],"smTxt":"2-7","lgTxt":"1-6"},
 {"name":"Mace, Horseman’s","kind":"melee","spd":6,"spdTxt":"6","len":"c. 1½’","space":"2’","adj":[1,1,0,0,0,0,0,0,0],"sm":[1,6,0],"lg":[1,4,0],"smTxt":"1-6","lgTxt":"1-4"},
 {"name":"Morning Star","kind":"melee","spd":7,"spdTxt":"7","len":"c. 4’","space":"5’","adj":[0,1,1,1,1,1,1,2,2],"sm":[2,4,0],"lg":[1,6,1],"smTxt":"2-8","lgTxt":"2-7"},
 {"name":"Partisan","kind":"melee","spd":9,"spdTxt":"9","len":"7’+","space":"3’","adj":[0,0,0,0,0,0,0,0,0],"sm":[1,6,0],"lg":[1,6,1],"smTxt":"1-6","lgTxt":"2-7"},
 {"name":"Pick, Military, Footman’s","kind":"melee","spd":7,"spdTxt":"7","len":"c. 4’","space":"4’","adj":[2,2,1,1,0,-1,-1,-1,-2],"sm":[1,6,1],"lg":[2,4,0],"smTxt":"2-7","lgTxt":"2-8"},
 {"name":"Pick, Military, Horseman’s","kind":"melee","spd":5,"spdTxt":"5","len":"c. 2’","space":"2’","adj":[1,1,1,1,0,0,-1,-1,-1],"sm":[1,4,1],"lg":[1,4,0],"smTxt":"2-5","lgTxt":"1-4"},
 {"name":"Pike, awl","kind":"melee","spd":13,"spdTxt":"13","len":"18’+","space":"1’","adj":[-1,0,0,0,0,0,0,-1,-2],"sm":[1,6,0],"lg":[1,12,0],"smTxt":"1-6","lgTxt":"1-12"},
 {"name":"Ranseur","kind":"melee","spd":8,"spdTxt":"8","len":"8’+","space":"1’","adj":[-2,-1,-1,0,0,0,0,0,1],"sm":[2,4,0],"lg":[2,4,0],"smTxt":"2-8","lgTxt":"2-8"},
 {"name":"Scimitar","kind":"melee","spd":4,"spdTxt":"4","len":"c. 3’","space":"2’","adj":[-3,-2,-2,1,0,0,1,1,3],"sm":[1,8,0],"lg":[1,8,0],"smTxt":"1-8","lgTxt":"1-8"},
 {"name":"Spear","kind":"melee","spd":6,"spdTxt":"6-8","len":"5’-13’+","space":"1’","adj":[-2,-1,-1,-1,0,0,0,0,0],"sm":[1,6,0],"lg":[1,8,0],"smTxt":"1-6","lgTxt":"1-8"},
 {"name":"Spetum","kind":"melee","spd":8,"spdTxt":"8","len":"8’+","space":"1’","adj":[-2,-1,0,0,0,0,0,1,2],"sm":[1,6,1],"lg":[2,6,0],"smTxt":"2-7","lgTxt":"2-12"},
 {"name":"Staff, quarter","kind":"melee","spd":4,"spdTxt":"4","len":"6’-8’","space":"3’","adj":[-7,-5,-3,-1,0,0,1,1,0],"sm":[1,6,0],"lg":[1,6,0],"smTxt":"1-6","lgTxt":"1-6"},
 {"name":"Sword, bastard","kind":"melee","spd":6,"spdTxt":"6","len":"c. 4½’","space":"4’+","adj":[0,0,1,1,1,1,1,1,0],"sm":[2,4,0],"lg":[2,8,0],"smTxt":"2-8","lgTxt":"2-16"},
 {"name":"Sword, broad","kind":"melee","spd":5,"spdTxt":"5","len":"c. 3½’","space":"4’","adj":[-3,-2,-1,0,0,1,1,1,2],"sm":[2,4,0],"lg":[1,6,1],"smTxt":"2-8","lgTxt":"2-7"},
 {"name":"Sword, long","kind":"melee","spd":5,"spdTxt":"5","len":"c. 3½’","space":"3’","adj":[-2,-1,0,0,0,0,0,1,2],"sm":[1,8,0],"lg":[1,12,0],"smTxt":"1-8","lgTxt":"1-12"},
 {"name":"Sword, short","kind":"melee","spd":3,"spdTxt":"3","len":"c. 2’","space":"1’","adj":[-3,-2,-1,0,0,0,1,0,2],"sm":[1,6,0],"lg":[1,8,0],"smTxt":"1-6","lgTxt":"1-8"},
 {"name":"Sword, two-handed","kind":"melee","spd":10,"spdTxt":"10","len":"c. 6’","space":"6’","adj":[2,2,2,2,3,3,3,1,0],"sm":[1,10,0],"lg":[3,6,0],"smTxt":"1-10","lgTxt":"3-18"},
 {"name":"Trident","kind":"melee","spd":6,"spdTxt":"6-8","len":"4’-8’+","space":"1’","adj":[-3,-2,-1,-1,0,0,1,0,1],"sm":[1,6,1],"lg":[3,4,0],"smTxt":"2-7","lgTxt":"3-12"},
 {"name":"Voulge","kind":"melee","spd":10,"spdTxt":"10","len":"8’+","space":"2’","adj":[-1,-1,0,1,1,1,0,0,0],"sm":[2,4,0],"lg":[2,4,0],"smTxt":"2-8","lgTxt":"2-8"},
 {"name":"Axe, hand","kind":"missile","spd":null,"rate":"1","range":["1","2","3"],"adj":[-4,-3,-2,-1,-1,0,0,0,1],"sm":[1,6,0],"lg":[1,4,0],"smTxt":"1-6","lgTxt":"1-4"},
 {"name":"Bow, composite, long","kind":"missile","spd":null,"rate":"2","range":["6","12","21"],"adj":[-2,-1,0,0,1,2,2,3,3],"sm":[1,6,0],"lg":[1,6,0],"smTxt":"1-6","lgTxt":"1-6"},
 {"name":"Bow, composite, short","kind":"missile","spd":null,"rate":"2","range":["5","10","18"],"adj":[-3,-3,-1,0,1,2,2,2,3],"sm":[1,6,0],"lg":[1,6,0],"smTxt":"1-6","lgTxt":"1-6"},
 {"name":"Bow, long","kind":"missile","spd":null,"rate":"2","range":["7","14","21"],"adj":[-1,0,0,1,2,3,3,3,3],"sm":[1,6,0],"lg":[1,6,0],"smTxt":"1-6","lgTxt":"1-6"},
 {"name":"Bow, short","kind":"missile","spd":null,"rate":"2","range":["5","10","15"],"adj":[-5,-4,-1,0,0,1,2,2,2],"sm":[1,6,0],"lg":[1,6,0],"smTxt":"1-6","lgTxt":"1-6"},
 {"name":"Club","kind":"missile","spd":null,"rate":"1","range":["1","2","3"],"adj":[-7,-5,-3,-2,-1,-1,-1,0,0],"sm":[1,6,0],"lg":[1,3,0],"smTxt":"1-6","lgTxt":"1-3"},
 {"name":"Crossbow, heavy","kind":"missile","spd":null,"rate":"½","range":["8","16","24"],"adj":[-1,0,1,2,3,3,4,4,4],"sm":[1,4,1],"lg":[1,6,1],"smTxt":"2-5","lgTxt":"2-7"},
 {"name":"Crossbow, light","kind":"missile","spd":null,"rate":"1","range":["6","12","18"],"adj":[-2,-1,0,0,1,2,3,3,3],"sm":[1,4,0],"lg":[1,4,0],"smTxt":"1-4","lgTxt":"1-4"},
 {"name":"Dagger","kind":"missile","spd":null,"rate":"2","range":["1","2","3"],"adj":[-5,-4,-3,-2,-1,-1,0,0,1],"sm":[1,4,0],"lg":[1,3,0],"smTxt":"1-4","lgTxt":"1-3"},
 {"name":"Dart","kind":"missile","spd":null,"rate":"3","range":["1½","3","4½"],"adj":[-5,-4,-3,-2,-1,0,1,0,1],"sm":[1,3,0],"lg":[1,2,0],"smTxt":"1-3","lgTxt":"1-2"},
 {"name":"Hammer","kind":"missile","spd":null,"rate":"1","range":["1","2","3"],"adj":[-2,-1,0,0,0,0,0,0,1],"sm":[1,4,1],"lg":[1,4,0],"smTxt":"2-5","lgTxt":"1-4"},
 {"name":"Javelin","kind":"missile","spd":null,"rate":"1","range":["2","4","6"],"adj":[-5,-4,-3,-2,-1,0,1,0,1],"sm":[1,6,0],"lg":[1,6,0],"smTxt":"1-6","lgTxt":"1-6"},
 {"name":"Sling (bullet)","kind":"missile","spd":null,"rate":"1","range":["5","10","20"],"adj":[-2,-2,-1,0,0,0,2,1,3],"sm":[1,4,1],"lg":[1,6,1],"smTxt":"2-5","lgTxt":"2-7"},
 {"name":"Sling (stone)","kind":"missile","spd":null,"rate":"1","range":["4","8","16"],"adj":[-5,-4,-2,-1,0,0,2,1,3],"sm":[1,4,0],"lg":[1,4,0],"smTxt":"1-4","lgTxt":"1-4"},
 {"name":"Spear","kind":"missile","spd":null,"rate":"1","range":["1","2","3"],"adj":[-3,-3,-2,-2,-1,0,0,0,0],"sm":[1,6,0],"lg":[1,8,0],"smTxt":"1-6","lgTxt":"1-8"}
]};
var MATRIX = RULES_DATA.matrix, WEAPONS = RULES_DATA.weapons;

// ---- Attack matrices (DMG p.74-75) ----
function colRange(l){
  var m=/^(\d+)(?:-(\d+)|(\+))?$/.exec(l);
  return m?{lo:+m[1],hi:m[3]?99:(m[2]?+m[2]:+m[1])}:null;
}
function colIndex(group,level){
  var cs=MATRIX[group].cols;
  for(var i=0;i<cs.length;i++){var r=colRange(cs[i]); if(r&&level>=r.lo&&level<=r.hi) return i;}
  return -1;
}
// DMG p.73: project upwards by 1s, repeating 20 six times before continuing with 21.
function repeat20(raw){ return (raw>=20&&raw<=25)?20:(raw>25?raw-5:raw); }
function projectedToHit(group,col,ac){ return repeat20(MATRIX[group].rows["10"][col]+(10-ac)); }
function toHit(group,col,ac){
  var row=MATRIX[group].rows[String(ac)];
  return row?row[col]:projectedToHit(group,col,ac);
}
var CLASSES={
  fighter:{label:"Fighter",group:"IB",atk:"F"},
  paladin:{label:"Paladin",group:"IB",atk:"F"},
  ranger:{label:"Ranger",group:"IB",atk:"R"},
  cleric:{label:"Cleric / Druid / Monk",group:"IA"},
  thief:{label:"Thief / Assassin",group:"ID1"},
  mu:{label:"Magic-User / Illusionist",group:"IC"},
  zero:{label:"0 level human or halfling",group:"IB",fixedCol:0},
  monster:{label:"Monster (by Hit Dice)",group:"II",byHD:true}
};
// PHB p.25 attacks table: Fighter/Paladin 1-6 1/1, 7-12 3/2, 13+ 2/1; Ranger 1-7 1/1, 8-14 3/2, 15+ 2/1
function attacksPerRound(cls,level){
  var a=CLASSES[cls].atk;
  if(a==="F") return level>=13?"2":level>=7?"3/2":"1";
  if(a==="R") return level>=15?"2":level>=8?"3/2":"1";
  return "1";
}
function classCol(cls,level){
  var c=CLASSES[cls];
  if(c.byHD) return level;
  if(c.fixedCol!==undefined) return c.fixedCol;
  return colIndex(c.group,level);
}

// ---- Armour class types (PHB p.36 Armor Class Table; weapon adjustments are indexed by AC type 2-10) ----
var ARMORS=[
  {name:"None",ac:10},{name:"Leather",ac:8},{name:"Padded",ac:8},{name:"Studded leather",ac:7},
  {name:"Ring mail",ac:7},{name:"Scale mail",ac:6},{name:"Chain mail",ac:5},{name:"Splint mail",ac:4},
  {name:"Banded mail",ac:4},{name:"Plate mail",ac:3},{name:"Natural / monster",ac:null}
];
function acType(armorIdx,shield){
  var a=ARMORS[armorIdx]; if(a.ac===null) return null;
  return Math.max(2,a.ac-(shield?1:0));
}
function weaponAdj(w,type){ return (type===null||type===undefined)?0:w.adj[type-2]; }

// ---- Special to-hit situations (DMG p.66, 67, 70) ----
var SITUATIONS=[
  {l:"Normal",b:0},
  {l:"Charging, survived first blows (+2, DMG p.66)",b:2},
  {l:"Attack from rear (+2, DMG p.70)",b:2},
  {l:"Opp. encumbered, held by one leg, off balance (+2, DMG p.67)",b:2},
  {l:"Opp. stunned, prone, motionless, slowed, both legs held (+4, DMG p.67, 70)",b:4},
  {l:"Opp. magically asleep, held, paralysed (automatic hit, DMG p.67)",b:0,auto:true},
  {l:"Attacker unseen by target: invisible (-4, DMG p.70)",b:-4}
];
var RANGE_PEN={S:0,M:-2,L:-5}; // DMG p.74-75 matrix note, PHB p.38 note

function needToHit(group,col,ac,adj,bon,pen){ return toHit(group,col,ac)-adj-bon+pen; }

// ---- Dice ----
function diceTxt(d,bonus){
  var b=d[2]+(bonus||0), s=d[0]+"d"+d[1];
  return b>0?s+"+"+b:b<0?s+b:s;
}
function rollDice(d,bonus,rndFn,mult){
  var t=0,rs=[];
  for(var i=0;i<d[0];i++){var r=rndFn(d[1]);rs.push(r);t+=r;}
  t=(t+d[2])*(mult||1)+(bonus||0);
  return {total:Math.max(1,t),rolls:rs};
}
// charge doubling: spear set against a charge, lance on a charging mount (PHB p.37 notes). The die result is doubled.
function doubles(w){ return /^(Spear|Lance)/.test(w.name); }

// ---- Strength and dexterity (PHB p.9, p.12) ----
function strAdj(score,pct){
  var s=Math.max(3,Math.min(18,score));
  if(s===18&&pct>0){
    if(pct<=50) return {hit:1,dmg:3};
    if(pct<=75) return {hit:2,dmg:3};
    if(pct<=90) return {hit:2,dmg:4};
    if(pct<=99) return {hit:2,dmg:5};
    return {hit:3,dmg:6};
  }
  if(s===3) return {hit:-3,dmg:-1};
  if(s<=5) return {hit:-2,dmg:-1};
  if(s<=7) return {hit:-1,dmg:0};
  if(s<=15) return {hit:0,dmg:0};
  if(s===16) return {hit:0,dmg:1};
  if(s===17) return {hit:1,dmg:1};
  return {hit:1,dmg:2};
}
function dexReaction(score){
  if(score<=3) return -3; if(score===4) return -2; if(score===5) return -1;
  if(score<=15) return 0; if(score===16) return 1; if(score===17) return 2; return 3;
}
function tens(pct){ return Math.floor(Math.max(0,Math.min(100,pct))/10); } // "per 10% over 18"

// ---- Surprise (DMG p.61-62) ----
// A side is surprised when its d6 is within its surprise range; segments lost = the die score.
// If both are surprised the lesser is subtracted from the greater.
function surpriseSegments(rollA,rangeA,rollB,rangeB){
  var sa=rollA<=rangeA?rollA:0, sb=rollB<=rangeB?rollB:0, d=sa-sb;
  return {a:d>0?d:0,b:d<0?-d:0};
}
// DEX reaction: penalty adds segments, bonus removes them, only for that individual, never creates surprise
function dexSegments(segs,react){ return segs>0?Math.max(0,segs-react):0; }

// ---- Initiative (DMG p.62-63) ----
function initWinner(ra,rb){ return ra>rb?"A":rb>ra?"B":"tie"; } // higher roll possesses initiative
// Weapon vs spell (DMG p.66-67): adjusted segment = |speed factor - losing initiative roll|
function timing(wsf,losing,cast){
  var adj=Math.abs(wsf-losing);
  return {adj:adj,result:adj<cast?"weapon":adj===cast?"simul":"spell"};
}
// Weapon vs weapon on tied initiative (DMG p.66)
function wvs(sa,sb){
  if(sa===sb) return {tie:true};
  var lo=Math.min(sa,sb), diff=Math.abs(sa-sb);
  return {tie:false,faster:sa<sb?"A":"B",diff:diff,lo:lo,two:(diff>=5||diff>=2*lo),three:(diff>=10)};
}

// ---- Pummel / grapple / overbear (DMG p.72-73) ----
var PUMMEL_TABLE=[
  {lo:-9999,hi:0,   res:"Blow misses, opponent may counter",      dmg:0, stun:false,note:""},
  {lo:1,    hi:20,  res:"Ineffective blow, strike again",         dmg:0, stun:false,note:""},
  {lo:21,   hi:40,  res:"Glancing blow, off balance*",            dmg:2, stun:false,note:"* Series ends, determine next strike"},
  {lo:41,   hi:60,  res:"Glancing blow, strike again",            dmg:4, stun:false,note:""},
  {lo:61,   hi:80,  res:"Solid punch, off balance*",              dmg:6, stun:false,note:"* Series ends, determine next strike"},
  {lo:81,   hi:100, res:"Solid punch, strike again",              dmg:8, stun:false,note:""},
  {lo:101,  hi:9999,res:"Crushing blow, opponent STUNNED",        dmg:10,stun:true, note:"** Opponent unable to attack for 1 full round"}
];
var GRAPPLE_TABLE=[
  {lo:-9999,hi:20,  res:"Waist clinch, opponent may counter",     dmg:0, stun:false,note:""},
  {lo:21,   hi:40,  res:"Arm lock / forearm / elbow smash",       dmg:1, stun:false,note:""},
  {lo:41,   hi:55,  res:"Hand or finger lock / bite",             dmg:2, stun:false,note:""},
  {lo:56,   hi:70,  res:"Bear hug / trip",                        dmg:3, stun:false,note:""},
  {lo:71,   hi:85,  res:"Headlock / flip or throw",               dmg:5, stun:false,note:""},
  {lo:86,   hi:95,  res:"Strangle hold / head butt",              dmg:6, stun:false,note:""},
  {lo:96,   hi:9999,res:"Kick / knee / gouge, opponent STUNNED",  dmg:8, stun:true, note:"Stunned opponent cannot counter for 1 round; a second attack may be made at once"}
];
var OVERBEAR_TABLE=[
  {lo:-9999,hi:20,  res:"Bounce off or avoided, opp. may counter",dmg:0, stun:false,note:""},
  {lo:21,   hi:40,  res:"Slip down and grab leg",                 dmg:0, stun:false,note:""},
  {lo:41,   hi:60,  res:"Opponent staggered, attack again",       dmg:1, stun:false,note:""},
  {lo:61,   hi:80,  res:"Opponent knocked to knees",              dmg:2, stun:false,note:""},
  {lo:81,   hi:100, res:"Opponent knocked to hands and knees",    dmg:3, stun:false,note:""},
  {lo:101,  hi:9999,res:"Opponent knocked flat, STUNNED 1 round", dmg:4, stun:true, note:"Some other form of combat MUST follow"}
];
var ARMOR_GRAPPLE={none:0,lp:10,crs:20,bps:30};          // defender armour, grapple/overbear base chance
var ARMOR_PUMMEL={none:0,lp:-10,crs:-20,bps:-40};        // defender armour, pummel result
var HELMET_PUMMEL={none:0,open:-5,nasal:-10,visor:-20};
var STRIKE_PUMMEL={fist:0,wood:5,metal:10};

function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function half(v,prone){ return Math.round(prone?v*0.5:v); }

// p: {atkDEX,atkSTR,atkPct,atkAC,oppAC,oppDEX,oppSTR,oppPct,armor,helmet,strike,faster,wtDiff,htDiff,varHit,varRes, flags...}
function hitChance(mode,p){
  var base,mods=0,auto=false;
  if(mode==="P"){
    base=Math.min(100,p.oppAC*10);                 // no lower clamp: AC 0 and below give no or negative chance, DMG p.72
    mods+=p.atkDEX+Math.max(0,p.atkSTR-15)+Math.abs(p.atkAC);
    if(p.slowed) mods+=10;
    if(p.stunned) mods+=20;
    if(p.helpless) auto=true;
    if(p.oppFast) mods-=5;
    if(p.hasted) mods-=10;
  }else{                                             // grapple and overbear share one base chance (DMG p.73)
    base=clamp(p.atkAC*10,0,100);
    mods+=p.atkDEX+ARMOR_GRAPPLE[p.armor||"none"];
    if(p.slowed||p.stunned) mods+=20;
    mods-=10*(p.faster||0);
    if(p.hasted) mods-=20;
  }
  mods+=p.varHit||0;
  return {base:base,mods:mods,chance:auto?100:clamp(base+mods,0,100),auto:auto};
}
function resultMods(mode,p){
  var r=0, pr=!!p.prone;
  if(mode==="P"){
    r+=Math.max(0,p.atkSTR-12)+2*tens(p.atkPct)+STRIKE_PUMMEL[p.strike||"fist"];
    if(p.slowed) r+=10; if(p.stunned) r+=20; if(p.helpless) r+=30;
    r-=2*Math.max(0,p.oppDEX-14);
    if(p.shield) r-=10;
    r+=ARMOR_PUMMEL[p.armor||"none"]+HELMET_PUMMEL[p.helmet||"none"];
    if(p.cloak) r-=30;
  }else if(mode==="G"){
    r+=p.atkDEX+p.atkSTR+tens(p.atkPct);
    if(p.slowed) r+=10; if(p.stunned) r+=20; if(p.helpless) r+=30;
    r+=5*(p.wtDiff||0)+half(5*(p.htDiff||0),pr);
    r-=half(2*Math.max(0,p.oppDEX-14),pr);
    r-=Math.max(0,p.oppSTR-12)+tens(p.oppPct);
    if(p.bp) r-=10; if(p.gorget) r-=10; if(p.shield) r-=10;
  }else{
    r+=p.atkSTR+2*tens(p.atkPct);
    if(p.slowed||p.oneFoot) r+=10;
    if(p.rush) r+=15;
    if(p.stunned||p.bothFeet) r+=20;
    r+=10*(p.wtDiff||0)+5*(p.htDiff||0);
    r-=Math.max(0,p.oppSTR-14)+2*tens(p.oppPct);
    r-=half(2*Math.max(0,p.oppDEX-14),pr);
    if(p.braced) r-=10;
  }
  return r+(p.varRes||0);
}
function lookupTable(adj,tbl){
  for(var i=0;i<tbl.length;i++){ if(adj>=tbl[i].lo&&adj<=tbl[i].hi) return tbl[i]; }
  return tbl[tbl.length-1];
}
// damage = table score + strength bonus; 25% actual (pummel, grapple), 50% actual (overbear); rounding up (interpretation)
function weaponlessDamage(mode,entryDmg,strBonus){
  var total=entryDmg>0?Math.max(0,entryDmg+strBonus):0, pct=(mode==="O")?50:25;
  var actual=Math.ceil(total*pct/100);
  return {total:total,pct:pct,actual:actual,incidental:total-actual};
}
// ==== RULES:END ====
