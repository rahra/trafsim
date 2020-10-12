

class TrafSim
{
   constructor(canvas, data)
   {
      this.canvas = canvas;
      this.data = data;

      this.timer = 0;

      this.t_frame = 1;
      this.ctx = this.canvas.getContext('2d');
      this.cur_frame = 0;

      this.sx = 1;
      this.sy = 1;

      this.d_max = 0;
      this.d_min = 0;

      this.init();
   }


   init()
   {
      this.d_max = this.d_min = this.data[0][0].d_pos;

      for (var i = 0; i < this.data.length; i++)
      {
         for (var j = 0; j < this.data[i].length; j++)
         {
            this.d_max = Math.max(this.d_max, this.data[i][j].d_pos);
            this.d_min = Math.min(this.d_min, this.data[i][j].d_pos);
         }
      }
   }


   scaling()
   {
      this.canvas.width = document.body.clientWidth;
      this.canvas.height = window.innerHeight;

      this.sx = this.canvas.width / (this.d_max - this.d_min);
      this.sy = this.canvas.height / 100;
   }


   next_frame()
   {
      this.cur_frame++;

      if (this.cur_frame >= this.data.length)
         window.clearInterval(this.timer);
   }


   draw()
   {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.save();
      this.ctx.scale(this.sx, this.sy);
      this.ctx.fillStyle = "red";

      for (var i = 0; i < this.data[this.cur_frame].length; i++)
      {

         this.ctx.beginPath();
         this.ctx.rect(this.data[this.cur_frame][i].d_pos - this.d_min, 1, 50, 1);
         this.ctx.fill();
      }

      this.ctx.restore();
   }
}


var canvas = document.getElementById('raceplane');
canvas.width = document.body.clientWidth;
canvas.height = window.innerHeight;

var ts = new TrafSim(canvas, data_);

ts.scaling();
ts.draw();

window.addEventListener('resize', function(e){ts.scaling(); ts.draw();});
ts.timer = window.setInterval(function(){ts.draw(); ts.next_frame();}, 40);


