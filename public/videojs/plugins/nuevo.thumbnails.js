;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory.bind(this, root, root.videojs));
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(root, root.videojs);
  } else {
    factory(root, root.videojs);
  }

})(window, function(window, videojs) {
  "use strict";
  window['nuevo_thumbnails'] = { version: "1.0" };

const onPlayerReady = (player,options) => {



	var defaults = {
			src:'',
				src:'',
				width:160,
				height:90,
				type: 'vertical'
	};
	

	var currentSlide="",currentSrc="",currentWidth,currentHeight,currentType;
	var slide_el, s_thumb, slide_img, s_thumb_dur,num_slide = 0;
	var nv=player.el();

	var holder = nv.querySelector(".vjs-progress-holder");
	try{
		options =  videojs.obj.merge(defaults, options || {});
	}catch(e) {
		options =  videojs.mergeOptions(defaults, options || {});
	}
	
	
	if(options.src) {

		let item = {slideImage:options.src};
		if(options.width) item.slideWidth=options.width;
		if(options.height) item.slideHeight=options.height;
		if(options.type) item.slideType=options.type;
		player.one("playing",function() {
			player.trigger("nuevothumbs",item);
		});
	}
	
	currentSrc=options.src;currentWidth=options.width;currentHeight=options.height;currentType=options.type;
	//if(player.slideImage) options.src=player.slideImage;

    var vjs_El = function(tagName, className, html) {
        var obj = document.createElement(tagName);
        if (typeof className !== "undefined") {
            if (className !== "") obj.className = className;
        }
        if (typeof html !== "undefined") {
            if (html !== "") obj.innerHTML = html;
        }
        return obj;
    };

            function progressIndex(how) {
                var ctr = player.controlBar.progressControl.el();
                if (how) {
                    ctr.setAttribute("style", "z-index:22");
                } else {
                    ctr.removeAttribute("style");
                }

            }

    

	player.on('nuevothumbs',function(e,data) {
		
	    console.log('on thumbs');
	
		if("slideImage" in data) {
			
		
			
			if (currentSrc!==data.slideImage) {
				
			

				currentSrc = data.slideImage;
		
				if("slideWidth" in data) currentWidth=data.slideWidth; else currentWidth=160;
			
				if("slideHeight" in data) currentHeight=data.slideHeight; else currentHeight=90;
		
				if("slideType" in data) currentType=data.slideType; else currentType='vertical';
	
	
				if (isSlide) {
					isSlide.classList.remove('vjs-hidden');
				}	
					setup_slides();
					
				}
			
			
		} else {
			
		
			var isSlide = nv.querySelector(".vjs-progress-slide");
			if (isSlide) {
				isSlide.classList.add('vjs-hidden');
			}
		}
		


		
	});



	function setup_slides() {

        player.sprite = false;
      
        var isSlide = nv.querySelector(".vjs-progress-slide");
        if (isSlide) isSlide.parentNode.removeChild(isSlide);

        holder.removeEventListener('mousemove', slidemove);
        holder.removeEventListener('mousedown', slidedown);
        holder.removeEventListener('mouseleave', slideout);
        holder.removeEventListener('touchstart', slidetouch);


        var isOver = nv.querySelector(".vjs-thumb-poster");
        if (isOver) nv.removeChild(isOver);

		if (currentSrc !== "" && currentSlide === currentSrc ) {
             return;
        }

        if (player.isAudio() !== true && currentSrc!=="") {

              currentSlide = currentSrc;
              var md_el = nv.querySelector(".vjs-mouse-display");
			  
			

              if (player.shadowSlide) {
				   
				   let poster = nv.querySelector('vjs-poster');
                   var posterThumb = vjs_El("div", "vjs-thumb-poster");
                   var canva = vjs_El("canvas");
				   posterThumb.appendChild(canva);
				   nv.insertBefore(posterThumb, poster);

			   }

			   

			   var play_pro = nv.querySelector(".vjs-play-progress");
               var tp_el = play_pro.querySelector(".vjs-time-tooltip");
                    
               if (tp_el) videojs.dom.addClass(tp_el, "vjs-abs-hidden");
               if (md_el) videojs.dom.addClass(md_el, "vjs-abs-hidden");

		

               player.sprite = true;
               slide_el = vjs_El("div", "vjs-progress-slide");
               s_thumb = vjs_El("div", "vjs-thumb");
               s_thumb_dur = vjs_El("div", "vjs-thumb-duration");
               slide_img = vjs_El("img");

               if (currentType === "horizontal") {
                   slide_img.style.width = "auto";
                   slide_img.style.height = currentHeight + "px";
               } else {
                   slide_img.style.height = "auto";
                   slide_img.style.width = currentWidth + "px";
               }

			   

               s_thumb.appendChild(slide_img);
               s_thumb.appendChild(s_thumb_dur);
               slide_el.appendChild(s_thumb);

               s_thumb.style.left = "-" + parseInt(currentWidth / 2, 10) + "px";
               holder.appendChild(slide_el);

               slide_el.style.left = "-1000px";
               var slide_left = 0,slide_top = 0;

               holder.addEventListener('mousemove', slidemove);
               holder.addEventListener('mousedown', slidedown);
               holder.addEventListener('mouseleave', slideout);
               holder.addEventListener('touchstart', slidetouch, {passive: true});



               var slides = new Image();
               slide_img.src = currentSrc;
               slides.src = currentSrc;
               slides.onload = function(event) {
                   var total_width = event.target.width;
                   var total_height = event.target.height;
                   num_slide = total_width / currentWidth;
                   if (currentType !== "horizontal")
                      num_slide = total_height / currentHeight;
                      videojs.dom.removeClass(slide_el, "vjs-hidden");
                   };
                }


                function slideend() {
                    holder.removeEventListener('touchmove', slidemove);
                    holder.removeEventListener('touchend', slideend);
                    thumbOut();
                }

                function slidetouch(e) {
                    progressIndex(true);
                    videojs.holderdown = false;
                    holder.addEventListener('touchmove', function(e) {
                        slidemove(e);
                    });
                    holder.addEventListener('touchend', slideend);
                }

                function formTime(seconds, guide) {
                    seconds = seconds < 0 ? 0 : seconds;
                    var s = Math.floor(seconds % 60);
                    var m = Math.floor(seconds / 60 % 60);
                    var h = Math.floor(seconds / 3600);
                    var gm = Math.floor(guide / 60 % 60);
                    var gh = Math.floor(guide / 3600);
                    if (isNaN(seconds) || seconds === Infinity) {
                        h = m = s = '-';
                    }
                    h = (h > 0 || gh > 0) ? h + ':' : '';
                    m = (((h || gm >= 10) && m < 10) ? '0' + m : m) + ':';
                    s = (s < 10) ? '0' + s : s;
                    return h + m + s;
                }

                function slidemove(e) {
                    progressIndex(true);
					if(nv.querySelector(".vjs-tech-chromecast")) return;

                    var rect = holder.getBoundingClientRect();

                    var pr_width = holder.offsetWidth;

                    var pagex = null;
                    if (e.pageX) {
                        pagex = e.pageX;
                    } else if (e.changedTouches) {
                        pagex = getPageX(e);
                    }

                    var ml = pagex - rect.left;

                    var calc_left = ml; //parseFloat(md.style.left);
                    var pos_left = ml; //Number(md.style.left.replace(/px$/, ""));
                    if (calc_left === 0 && holder.offsetWidth > 0 && videojs.holderdown) {
                        calc_left = holder.offsetWidth;
                        pos_left = calc_left;
                    }

                    var percent = Number(calc_left) / Number(pr_width);

                    var mouseTime = percent * player.duration();
                    s_thumb_dur.innerHTML = formTime(mouseTime, player.duration());


                    var num = parseInt(percent * num_slide, 10);
                    s_thumb.style.width = currentWidth + "px";
                    s_thumb.style.height = currentHeight + "px";
                    var bg = 0;
                    if (currentType === "horizontal") {
                        bg = num * currentWidth;
                        slide_img.style.left = "-" + bg + "px";
                        slide_left = bg;
                        slide_top = 0;
                    } else {
                        bg = num * currentHeight;
                        slide_img.style.top = "-" + bg + "px";
                        slide_left = 0;
                        slide_top = bg;
                    }


                    var min_left = currentWidth / 2;
                    var max_left = holder.offsetWidth - currentWidth / 2;

                    if (pos_left > max_left) pos_left = max_left;
                    if (pos_left < min_left) pos_left = min_left;

                    slide_el.style.left = parseInt(pos_left, 10) + "px";

                    if (videojs.holderdown && player.shadowSlide) {
                        var context = canva.getContext("2d");
                        canva.width = nv.offsetWidth;
                        canva.height = nv.offsetHeight;
                        posterThumb.style.width = nv.offsetWidth + "px";
                        posterThumb.style.height = nv.offsetHeight + "px";
                        context.drawImage(slide_img, slide_left, slide_top, currentWidth, currentHeight, 0, 0, canva.width, canva.height);
                    }
                    videojs.dom.addClass(s_thumb, "vjs-thumb-show");
                };

                function slideup() {
                    videojs.holderdown = false;
                    document.removeEventListener('mousemove', slidemove);
                    thumbOut();

                }

                function slidedown() {
                    progressIndex(true);
                    document.addEventListener('mousemove', slidemove);
                    document.addEventListener('mouseup', slideup);
                    if (player.shadowSlide) {
                        var context = canva.getContext("2d");
                        canva.width = nv.offsetWidth;
                        canva.height = nv.offsetHeight;
                        posterThumb.style.width = nv.offsetWidth + "px";
                        posterThumb.style.height = nv.offsetHeight + "px";
                        context.drawImage(slide_img, slide_left, slide_top, currentWidth, currentHeight, 0, 0, canva.width, canva.height);
                    }
                };

                function thumbOut() {
                    progressIndex(false);
                    if (slide_el) {
                        videojs.dom.removeClass(s_thumb, "vjs-thumb-show");
                        if (player.shadowSlide) {
                            canva.width = 0;
                            canva.height = 0;
                            posterThumb.removeAttribute("style");
                        }
                    }
                }

                function slideout() {

                    thumbOut();
                };



            }



	return this;
	
};




const nuevothumbnails = function(options) {
  this.on('nuevoReady',function() {
    onPlayerReady(this,options);
  });
};

 var registerPlugin = videojs.registerPlugin || videojs.plugin;
 registerPlugin('nuevothumbnails', nuevothumbnails);
});