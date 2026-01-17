function checkInternet(callback, intervalMs = 5000) {    
    const intervalId = setInterval(() => {
        try {
            // Google DNS'e ping at (en güvenilir)
            var result = http.get("http://www.google.com/generate_204", {
              timeout: 5000
            });
            if(result.statusCode === 204 || result.statusCode === 200){
                callback(true)
            }else{
                callback(false)
            }
        } catch (e) {
            callback(false)
        }
    }, intervalMs);
    
    // interval'i durdurmak için return et
    return {
        stop: function() {
            clearInterval(intervalId);
        }
    };
}

module.exports = {
    checkInternet: checkInternet
}