(()=> {
    return {
        checkInternet: function(callback, intervalMs = 5000) {
            const http = require('http');
            
            const intervalId = setInterval(() => {
                try {
                    const result = http.get("http://8.8.8.8", {
                        timeout: 3000
                    });
                    
                    callback(true);
                } catch (e) {
                    callback(false);
                }
            }, intervalMs);
            
            // interval'i durdurmak için return et
            return {
                stop: function() {
                    clearInterval(intervalId);
                }
            };
        }
    }
})();