

const COL = ["#0000FF", "#8A2BE2", "#A52A2A", "#DEB887", "#5F9EA0", "#7FFF00", "#D2691E", "#FF7F50", "#6495ED", "#FFF8DC", "#DC143C", "#00FFFF"];


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
      this.ctx.clearRect(0, 0, this.canvas.width, 100);

      this.ctx.save();
      this.ctx.scale(this.sx, this.sy);
      this.ctx.lineWidth = 0.5;

      for (var i = 0; i < this.data[this.cur_frame].length - 1; i++)
      {
         this.ctx.fillStyle = COL[i];
         this.ctx.beginPath();
         this.ctx.rect(this.data[this.cur_frame][i].d_pos - this.d_min, 1, 50, 1);
         this.ctx.fill();

         this.ctx.strokeStyle = COL[i];
         this.ctx.beginPath();
         this.ctx.moveTo(this.data[this.cur_frame][i].d_pos - this.d_min, 100 - this.data[this.cur_frame][i].v_cur * 1.5);
         this.ctx.lineTo(this.data[this.cur_frame + 1][i].d_pos - this.d_min, 100 - this.data[this.cur_frame + 1][i].v_cur * 1.5);
         this.ctx.stroke();
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


