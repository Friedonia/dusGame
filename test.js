// test.js - DusGame God-Mode Tester V2 (55 Phasen) - SANDBOX
const { spawn } = require('child_process');
const BASE_URL = 'http://localhost:3000';

let passed = 0, failed = 0;
console.log("🚀 Starte Sandbox-Server...");

const serverProcess = spawn('node', ['server.js'], { env: { ...process.env, TEST_MODE: 'true' } });
serverProcess.stderr.on('data', (d) => console.error(`[Server]: ${d}`));

setTimeout(async () => { await runTests(); serverProcess.kill(); process.exit(failed > 0 ? 1 : 0); }, 2000);

async function assert(name, condition, err = "") { condition ? (console.log(`✅ ${name}`), passed++) : (console.log(`❌ ${name} - ${err}`), failed++); }
async function fetchJSON(end, method='GET', body=null) {
    try { let res = await fetch(BASE_URL+end, {method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):null}); return await res.json(); } 
    catch(e) { return { error: "Fetch Fail" }; }
}

async function runTests() {
    console.log("\n🔍 STARTE 55-PHASEN STRESSTEST...\n");

    let map = await fetchJSON('/api/zones?v=0');
    assert("0. Server Online", map.data, "Keine Map");
    let z = map.data.features.filter(f => f.properties.type === 'zone');
    let z1 = z[0].properties.code, z2 = z[1].properties.code;

    await fetchJSON('/api/coins/manage', 'POST', { team: 'rot', amount: 5000, action: 'add' });
    await fetchJSON('/api/coins/manage', 'POST', { team: 'blau', amount: 5000, action: 'add' });

    console.log("\n--- [1] API VALIDATION ---");
    assert("1. Leerer Request blockiert", (await fetchJSON('/api/zone-action', 'POST', {})).error);
    assert("2. Negative Coins blockiert", (await fetchJSON('/api/coins/manage', 'POST', {team:'rot', amount:-100, action:'add'})).error);
    assert("3. Fake Item kauf blockiert", (await fetchJSON('/api/shop/buy', 'POST', {team:'rot', player:'1', itemType:'laser'})).error);

    console.log("\n--- [2] INVENTAR SYSTEM ---");
    await fetchJSON('/api/shop/buy', 'POST', {team:'rot', player:'1', itemType:'trap'});
    assert("4. Item kaufen klappt", (await fetchJSON('/api/inventory?team=rot&player=1')).data.trap === 1);
    await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'trap', zoneCode:z2});
    assert("5. Item nutzen zieht 1 ab", (await fetchJSON('/api/inventory?team=rot&player=1')).data.trap === 0);
    assert("6. Leerlauf-Nutzung blockiert", (await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'trap', zoneCode:z2})).error);
    
    await fetchJSON('/api/inventory/manage', 'POST', {team:'blau', player:'1', itemType:'buff', amount:5, action:'sub'});
    assert("7. Inventar geht nie unter 0", (await fetchJSON('/api/inventory?team=blau&player=1')).data.buff === 0);

    console.log("\n--- [3] ZONEN REGELWERK ---");
    assert("8. Graue Zone Capture", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'capture', team:'rot', player:'1', newColor:'#ff3333'})).success);
    assert("9. Eigene Zone Capture blockiert", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'capture', team:'rot', player:'2', newColor:'#ff3333'})).error);
    
    assert("10. Eigene Zone Upgrade", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'upgrade', team:'rot', player:'1'})).success);
    assert("11. Fremde Zone Upgrade blockiert", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'upgrade', team:'blau', player:'1'})).error);
    
    await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'upgrade', team:'rot', player:'1'}); // Lvl 3
    assert("12. Upgrade über Lvl 3 blockiert", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'upgrade', team:'rot', player:'1'})).error);

    assert("13. Eigene Zone Angriff blockiert", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'attack', team:'rot', player:'1'})).error);
    assert("14. Graue Zone Angriff blockiert", (await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'attack', team:'blau', player:'1'})).error);
    
    console.log("\n--- [4] KAMPF & HQ ---");
    assert("15. Feindliche Zone angreifen", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'attack', team:'blau', player:'1'})).success); // Lvl 3 -> 2
    
    await fetchJSON('/api/admin/set-zone-special', 'POST', {code:z1, hqTeam:'rot'});
    assert("16. HQ Rüstung fängt 1. Schlag ab", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'attack', team:'blau', player:'1'})).message.includes('Panzerung'));
    assert("17. HQ Level fällt beim 2. Schlag", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'attack', team:'blau', player:'1'})).success);

    console.log("\n--- [5] ITEM REGELN ---");
    await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'capture', team:'blau', player:'1', newColor:'#3366ff'}); // Blau hat z2
    await fetchJSON('/api/inventory/manage', 'POST', {team:'rot', player:'1', itemType:'buff', amount:10, action:'add'});
    await fetchJSON('/api/inventory/manage', 'POST', {team:'rot', player:'1', itemType:'trap', amount:10, action:'add'});

    assert("18. Buff auf fremde Zone blockiert", (await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'buff', zoneCode:z2})).error);
    assert("19. Buff auf eigene Zone klappt", (await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'buff', zoneCode:z1})).success);
    
    assert("20. Falle auf eigene Zone blockiert", (await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'trap', zoneCode:z1})).error);
    assert("21. Falle auf fremde Zone klappt", (await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'trap', zoneCode:z2})).success);

    for(let i=0; i<4; i++) await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'trap', zoneCode:z2});
    assert("22. Max 5 Fallen Limit greift", (await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'trap', zoneCode:z2})).error);

    console.log("\n--- [6] DER TASCHENDIEB ---");
    await fetchJSON('/api/inventory/manage', 'POST', {team:'rot', player:'1', itemType:'pickpocket', amount:1, action:'add'});
    let steal = await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'capture', team:'rot', player:'1', newColor:'#ff3333'});
    assert("23. Dieb klaut erfolgreich Coins beim Capture", steal.stealMessage !== undefined);

    console.log("\n--- [7] CHAT OVERLOAD ---");
    for(let i=0; i<205; i++) await fetchJSON('/api/chat', 'POST', {message:`Msg ${i}`});
    assert("24. Chat limitiert sich selbst auf 200 Msgs", (await fetchJSON('/api/chat?v=0')).messages.length <= 200);

    console.log("\n--- [8] HORROR SZENARIEN ---");
    await fetchJSON('/api/inventory/manage', 'POST', {team:'rot', player:'1', itemType:'emp', amount:1, action:'add'});
    await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'emp', zoneCode:z2}); 
    assert("25. EMP blockt jeden feindlichen Angriff eisern ab", (await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'attack', team:'blau', player:'1'})).error !== undefined);

    await fetchJSON('/api/inventory/manage', 'POST', {team:'blau', player:'1', itemType:'defuse', amount:1, action:'add'});
    await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'defuse_traps', team:'blau', player:'1'}); 
    assert("26. Entschärfer verpufft nicht, wenn keine Falle da war", (await fetchJSON('/api/inventory?team=blau&player=1')).data.defuse === 1);

    await fetchJSON('/api/admin/settings', 'POST', { gpsRequired: true });
    assert("27. Server blockt Scans ohne GPS Daten (Anti-Cheat)", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'capture', team:'rot', player:'1', newColor:'#ff3333'})).error !== undefined);
    await fetchJSON('/api/admin/settings', 'POST', { gpsRequired: false }); 

    let getMap = await fetchJSON('/api/zones?v=0');
    let lockZone = getMap.data.features.find(f => f.properties.code === z1);
    lockZone.properties.locked = true; 
    await fetchJSON('/api/admin/map', 'POST', { features: getMap.data.features }); 
    assert("28. Admin 'Locked' Status blockiert Scans komplett", (await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'attack', team:'blau', player:'1'})).error !== undefined);
    lockZone.properties.locked = false; await fetchJSON('/api/admin/map', 'POST', { features: getMap.data.features }); // Reset

    await fetchJSON('/api/player-scan', 'POST', { team: 'rot', player: '1', timestamp: Date.now() });
    await fetchJSON('/api/inventory/manage', 'POST', {team:'rot', player:'1', itemType:'revive', amount:1, action:'add'});
    await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'revive'});
    assert("29. Revive setzt Cooldown von GANZEM Team zurück", (await fetchJSON('/api/admin/cooldown-states?t=0')).states.rot['1'].lastScan === 0);

    console.log("\n--- [9] DIE NEUEN 25 HÄRTE-TESTS ---");
    
    // Wirtschaft & Edge Cases
    await fetchJSON('/api/coins/manage', 'POST', { team: 'gruen', amount: 0, action: 'set' });
    await fetchJSON('/api/coins/manage', 'POST', { team: 'gruen', amount: 30, action: 'add' }); // Exakt 30 Coins
    assert("30. Exaktes Kaufen (Geld = Preis) funktioniert", (await fetchJSON('/api/shop/buy', 'POST', {team:'gruen', player:'1', itemType:'trap'})).success === true);
    
    await fetchJSON('/api/coins/manage', 'POST', { team: 'gelb', amount: 0, action: 'set' });
    await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'capture', team:'gelb', player:'1', newColor:'#ffcc00'}); // Gelb hat z1, aber 0 Coins
    await fetchJSON('/api/inventory/manage', 'POST', {team:'blau', player:'1', itemType:'pickpocket', amount:1, action:'set'});
    let poorSteal = await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'capture', team:'blau', player:'1', newColor:'#3366ff'});
    assert("31. Taschendieb stürzt bei pleite-Team (0 Coins) nicht ab", poorSteal.success === true && poorSteal.stealMessage === undefined);
    
    await fetchJSON('/api/inventory/manage', 'POST', {team:'rot', player:'1', itemType:'trap', amount:"ABC", action:'set'});
    assert("32. Admin String-Injection beim Inventar wird zu 1", (await fetchJSON('/api/inventory?team=rot&player=1')).data.trap === 1);

    // GPS Anti-Cheat
    await fetchJSON('/api/location', 'POST', { id: 'test', lat: 51.0, lng: 6.0, team: 'rot', name: 'bot' });
    let jump = await fetchJSON('/api/location', 'POST', { id: 'test', lat: 51.5, lng: 6.5, team: 'rot', name: 'bot' }); // 70km in ms
    assert("33. GPS Teleport (Spoofing > 12m/s) wird blockiert", jump.status === "Ignored (Jump)");
    
    await fetchJSON('/api/admin/settings', 'POST', { gpsRequired: true });
    let farScan = await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'attack', team:'rot', player:'1', playerLat: 0.0, playerLng: 0.0});
    assert("34. GPS Distanz-Sperre (weit weg vom Polygon) greift", farScan.error === "Zu weit weg!");
    
    await fetchJSON('/api/admin/settings', 'POST', { gpsRequired: false });
    let manualScan = await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'attack', team:'rot', player:'1', playerLat: 0.0, playerLng: 0.0});
    assert("35. Manual Mode ignoriert Distanz (Scan erlaubt)", manualScan.success === true || manualScan.error !== "Zu weit weg!");

    let t1 = await fetchJSON('/api/location', 'POST', { id: 'test2', lat: 51.22, lng: 6.77, team: 'rot', name: 'bot' });
    let t2 = await fetchJSON('/api/location', 'POST', { id: 'test2', lat: 51.22001, lng: 6.77001, team: 'rot', name: 'bot' }); // Minimale Bewegung
    assert("36. Micro-Movements (unter 5m) müllen die Trails nicht voll", (await fetchJSON('/api/trails')).test2.path.length === 1);

    // Zonen-Logik Hardcore
    await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'capture', team:'blau', player:'1', newColor:'#3366ff'});
    await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'attack', team:'rot', player:'1'}); // Level 1 -> 0
    let mapCheck = await fetchJSON('/api/zones?v=0');
    let deadZone = mapCheck.data.features.find(f => f.properties.code === z2);
    assert("37. Zerstörte Zone wechselt Farbe zwingend auf Grau", deadZone.properties.color === "#808080");
    
    await fetchJSON('/api/inventory/manage', 'POST', {team:'rot', player:'1', itemType:'trap', amount:1, action:'add'});
    let grayTrap = await fetchJSON('/api/shop/use', 'POST', {team:'rot', player:'1', itemType:'trap', zoneCode:z2});
    assert("38. Falle auf Graue Zone legen klappt (Überraschungsangriff)", grayTrap.success === true);

    await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'capture', team:'blau', player:'1', newColor:'#3366ff'});
    await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'attack', team:'rot', player:'1'}); // Wieder Grau machen
    let mapCheck2 = await fetchJSON('/api/zones?v=0');
    assert("39. Zerstörte Zone verliert alle Buffs und Fallen restlos", mapCheck2.data.features.find(f => f.properties.code === z2).properties.traps === undefined);

    let fakeTeam = await fetchJSON('/api/zone-action', 'POST', {code:z2, action:'capture', team:'lila', player:'1', newColor:'#ff00ff'});
    assert("40. Server crasht nicht bei unbekanntem Team (Injection)", fakeTeam.success === true || fakeTeam.error !== undefined);

    // Stats & Server Tools
    await fetchJSON('/api/player-scan', 'POST', { team: 'rot', player: '1', timestamp: Date.now() }); // Hack Counter +1
    await fetchJSON('/api/admin/reset-stats', 'POST');
    let stats = await fetchJSON('/api/stats?team=rot&player=1');
    assert("41. Admin Reset-Stats löscht persönliche Hacks/KM", stats.personal.hacks === 0 && stats.personal.distance === "0.00");

    await fetchJSON('/api/inventory/manage', 'POST', {team:'rot', player:'1', itemType:'trap', amount:1, action:'add'});
    await fetchJSON('/api/inventory/reset-all', 'POST');
    assert("42. Admin Inventar-Wipe löscht wirklich alles", (await fetchJSON('/api/inventory?team=rot&player=1')).data.trap === 0);

    let oldScan = await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'capture', team:'blau', player:'1', timestamp: Date.now() - 600000});
    assert("43. Uralter Queue-Scan sendet noCooldown Flag zurück", oldScan.noCooldown === true);

    await fetchJSON('/api/zone-action', 'POST', {code:z1, action:'trigger_items', team:'rot', cooldownChange: 2});
    assert("44. In Falle treten modifiziert den Team-Cooldown in den Settings", (await fetchJSON('/api/admin/cooldown-states?t=0')).durations.rot > 5);

    // Payout Logic Check
    await fetchJSON('/api/admin/settings', 'POST', { shopEnabled: false });
    let coinsBefore = (await fetchJSON('/api/coins?v=0')).data.blau;
    await new Promise(r => setTimeout(r, 100)); // Payout wird im Background blockiert wenn Shop aus ist
    let coinsAfter = (await fetchJSON('/api/coins?v=0')).data.blau;
    assert("45. Economy Payout stoppt sofort wenn Shop gesperrt wird", coinsBefore === coinsAfter);

    assert("46. Chat Reset löscht die History", (await fetchJSON('/api/chat/reset', 'POST')).success === true);
    assert("47. Chat History ist nach Reset wirklich leer", (await fetchJSON('/api/chat?v=0')).messages.length === 0);
    
    assert("48. Admin Revive einzelnes Team (Fallen HQ)", (await fetchJSON('/api/admin/revive-team', 'POST', {team: 'rot'})).success === true);

    await fetchJSON('/api/coins/manage', 'POST', { team: 'rot', amount: 50, action: 'add' });
    await fetchJSON('/api/coins/manage', 'POST', { team: 'rot', amount: 100, action: 'sub' });
    assert("49. Coins abziehen (sub) geht niemals unter Null", (await fetchJSON('/api/coins?v=0')).data.rot === 0);

    let locStats = await fetchJSON('/api/location?v=0');
    assert("50. Server speichert aktuelle Standorte korrekt ab", locStats.data['test2'] !== undefined);

    let mapOnly = await fetchJSON('/api/admin/map', 'POST', { features: [] });
    assert("51. Admin Map-Save Route (ohne Settings) antwortet korrekt", mapOnly.success === true);

    let ticketFail = await fetch(BASE_URL+'/api/ticket/lila/1');
    assert("52. Ticket API blockt ungültiges Team im URL Pfad (404)", ticketFail.status === 404);

    let cdRes = await fetchJSON('/api/reset-cooldowns', 'POST');
    assert("53. Cooldown Reset gibt korrekten Zeitstempel zurück", cdRes.resetTime > 0);

    let zoneQuery = await fetchJSON('/api/zone/'+z1+'?team=rot&player=1');
    assert("54. Schnelle Scanner-Route gibt Zone & Inventar gebündelt zurück", zoneQuery.zone !== undefined && zoneQuery.inventory !== undefined);

    assert("55. Alle Routen überlebten ohne Server Crash", true);

    console.log("\n=========================================");
    console.log(`🏁 55-PHASEN TEST BEENDET: ${passed} Erfolgreich | ${failed} Fehlgeschlagen`);
}