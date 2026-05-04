var num=3;
function redirect(){
        num--;
        // document.getElementById("num").innerHTML=num;
        if(num<0){
                // document.getElementById("num").innerHTML=0;
                location.href=window.location.protocol+"//"+window.location.host;
                }
}
setInterval("redirect()", 1000);