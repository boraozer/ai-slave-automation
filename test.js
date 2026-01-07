function isInRoom() {
    try {
        const inRoom = text("Bir şey söyle…").exists();
        
        if (inRoom) {
            console.log(">>> ODA İÇİNDE <<<");
        }else{
            console.log(">>> ODA DIŞINDA <<<");
        }
        
        return inRoom;
    } catch (e) {
        console.warn("Oda kontrolü hatası:", e.message);
        return false;
    }
}
setTimeout(() => {
    isInRoom()
}, 10000);