
//! global configuration structure
var config_ =
{
   //! simulation frames per redraw
   SIM_FPD: 1,
   //! display framerate
   FPS: 25,
   //! maximum number of mobjs in the game (0 for unlimited)
   MAX_MOBJS: 0,
   //! new mobjs do not enter befor MIN_ENTRY_POS meters
   MIN_ENTRY_POS: 300,
   /*! Probability that a new mobj fills in if MIN_ENTRY_POS is ok. This controls
    * the traffic density. */
   P_FILL_IN: 0.3,
   //! display size of mobjs
   DSIZE: 6,
   //! maximum frames to calculate (0 for unlimited)
   MAX_FRAMES: 0,
   //! use Math.random() as PRNG
   USE_MATH_RANDOM: 0,
   //! display visibility range line
   SHOW_VIS_RANGE: 0,
   //! mobj failure probability per hour
   MOBJ_FAIL: 0.0,
   //! absolute minimum distance
   MOBJ_D_MIN: 10,
   //! course distance
   DISTANCE: 25000,
   //! pre-simulation distance
   PRESIM_DISTANCE: -2500,
   //! number of lanes
   NUM_LANES: 3,
   //! distribution of mobj types
   MOBJ_TYPES: [
      {type: "car", p: 0.35},
      {type: "truck", p: 0.3},
      {type: "bike", p: 0.01},
      {type: "blocking", p: 0.29},
      {type: "aggressive", p: 0.05},
   ]
};

// overwrite data in global config struct based on user config struct
if (typeof config !== "undefined")
{
   for (const k of Object.keys(config_))
      if (config.hasOwnProperty(k))
         config_[k] = config[k];
}

/*! internal consts */
//! mobj actions
const MOBJ_ACT = {
   NONE: 0,
   CRASH: 1,
   ACC: 2,
   DEC: 3,
   LEFT: 4,
   RIGHT: 5
};


function is_null(a)
{
   if (a == null)
      console.log("null pointer caught!");

   return a == null;
}


/*! This class implements a simple (non-cryptographic) PRNG. It used to have
 * the ability to always start at the same seed which may be interesting to be
 * able to compare simulation data.
 */
class SRandom
{
   //! seed of PRNG
   static seed = 1;


   /*! Generate a pseudo-random number.
    * @return Returns number x, 0.0 <= x < 1.0
    */
   static rand()
   {
      if (config_.USE_MATH_RANDOM)
         return Math.random();

      var x = Math.sin(SRandom.seed++) * 10000;
      return x - Math.floor(x);
   }


   /*! Generate random event with probability p.
    * @param p Probability of event, p should be 0.0 <= p < 1.0.
    * @return Returns true with a probability of p, otherwise false.
    */
   static rand_ev(p)
   {
      return SRandom.rand() < p;
   }
}


class FormatTime
{
   static pad0(a)
   {
      if (a.toString().length == 1)
         return "0" + a;
      return a.toString();
   }


   static hms(t)
   {
      var h, m, s;

      h = Math.floor(t / 3600.0);
      m = Math.floor(t / 60.0) % 60;
      s = Math.floor(t) % 60;

      return FormatTime.pad0(h) + ":" + FormatTime.pad0(m) + ":" + FormatTime.pad0(s);
   }
}


class DListNode
{
   constructor(data = null)
   {
      //! double linked list
      this.prev = null;    // previous means ahead
      this.next = null;    // next means behind
      //! data pointer
      this.data = data;
   }


   /*! This removes all references to help the GC.
    */
   destructor()
   {
      delete this.data;
      delete this.next;
      delete this.prev;
   }


   /*! Insert node directly before this.
    * @param node Node to insert.
    */
   insert(node)
   {
      // safety check
      if (is_null(node)) return;

      node.prev = this.prev;
      node.next = this;
      if (this.prev != null)
         this.prev.next = node;
      this.prev = node;
   }


   /*! Append node directly behind this.
    * @param node Node to append.
    */
   append(node)
   {
      if (is_null(node)) return;

      node.prev = this;
      node.next = this.next;
      if (this.next != null)
         this.next.prev = node;
      this.next = node;
   }


   /*! Unlink (remove) this node from list.
    */
   unlink()
   {
      // safety check
      if (this.data == null)
         console.log("unlinking head or tail node!");

      if (this.prev != null)
         this.prev.next = this.next;
      if (this.next != null)
         this.next.prev = this.prev;
   }
}


class Lane
{
   static id_cnt = 0;


   constructor()
   {
      //! lane id
      this.id = Lane.id_cnt++;
      //! pointer to first mobj, head element
      this.first = new DListNode();
      //! pointer to last mobj, tail element
      this.last = new DListNode();
      //! neighbor lanes
      this.left = null;
      this.right = null;
      //! average speed
      this.v_avg = 0;
      //! number of mobjs in sim range
      this.n_sim = 0;

      this.first.next = this.last;
      this.last.prev = this.first;
   }


   /*! Determine length of list.
    * @return Returns length of list, excluding the head and tail element.
    */
   get length()
   {
      var i, node;

      for (i = 0, node = this.first.next; node.data != null; node = node.next, i++);

      return i;
   }


   /*! Return DLinkNode which is directly ahead of position d_pos.
    * @param d_pos Position from which to look ahead.
    * @return Returns the DListNode of the object ahead.
    */
   ahead_of(d_pos)
   {
      var node;

      for (node = this.last.prev; node.data != null; node = node.prev)
         if (node.data.d_pos > d_pos)
            break;

      return node;
   }


   /*! Return average time.
    */
   get t_avg()
   {
      return this.v_avg > 0 ? config_.DISTANCE / this.v_avg : 0;
   }


   /*! Return mobj frequency (per hour).
    */
   get f_sim()
   {
      return this.t_avg > 0 ? 3600 * this.n_sim / this.t_avg : 0;
   }

   /*! Get mobj density (mobjs per km).
    */
   get r_sim()
   {
      return 1000 * this.n_sim / config_.DISTANCE;
   }

   recalc(t_cur)
   {
      //! max number of iterations to prevent endless loop
      const MAX_LOOP = 10;
      var crash_cnt = 0;
      var v_avg = 0, n = 0;

      this.integrity();
      // loop as long as no lane change appeared (because of changes in the linked list)
      for (var node = this.first.next, i = 0; node.data != null && i < MAX_LOOP; i++)
      {
         // loop over all elements in the list
         for (; node.data != null; node = node.next)
         {
            // get average speed
            if (node.data.t_cur < t_cur && node.data.t_end > 0)
            {
               v_avg += node.data.v_avg;
               n++;
            }

            // restart outer loop in case of a lane change
            var act = node.data.recalc(t_cur);
            if (act == MOBJ_ACT.LEFT || act == MOBJ_ACT.RIGHT)
            {
               node = this.first.next;
               break;
            }
            if (act == MOBJ_ACT.CRASH)
               crash_cnt++;
         }
      }

      if (i >= MAX_LOOP)
         console.log("probably endless loop in recalc()");

      this.v_avg = v_avg / n;
      this.n_sim = n;

      return crash_cnt;
   }


   integrity()
   {
      if (this.first == null && this.last != null)
         console.log("ERR1");
      if (this.first != null && this.last == null)
         console.log("ERR2");
      if (this.first != null && this.first.prev != null)
         console.log("ERR3");
      if (this.last != null && this.last.next != null)
         console.log("ERR4");
      if (this.last.data != null)
         console.log("ERR5");
      if (this.first.data != null)
         console.log("ERR6");
   }
}


class TrafSim
{
   constructor(rlen = config_.DISTANCE)
   {
      this.lanes = [];
      this.timer = null;

      this.t_frame = 1;
      this.cur_frame = 0;

      this.d_max = rlen;
      this.d_min = config_.PRESIM_DISTANCE;

      //! mobjs in total on all lanes
      this.mobj_cnt = 0;
      //! mobjs per km
      this.mobj_density = 0;
      //! average time
      this.t_avg = 0;
      this.crash_cnt = 0;
      //! average speed
      this.v_avg = 0;
      //! sum of numbers to average
      this.avg_cnt = 0;

      this.running = 1;
      this.sim_fpd = config_.SIM_FPD;
      //! helper var for synchronizing key strokes
      this.key_action = "";

      this.init_lanes();
   }


   init_lanes()
   {
      for (var i = 0; i < config_.NUM_LANES; i++)
      {
         // create new lane
         this.lanes.push(new Lane());

         // point to neigbor lanes
         if (i)
         {
            this.lanes[i - 1].left = this.lanes[i];
            this.lanes[i].right = this.lanes[i - 1];
         }
      }
   }


   random_mobj_type()
   {
      var rnd = SRandom.rand();
      for (var i = 0; i < config_.MOBJ_TYPES.length; i++)
      {
         if (rnd < config_.MOBJ_TYPES[i].p)
            return config_.MOBJ_TYPES[i].type;
         rnd -= config_.MOBJ_TYPES[i].p;
      }
      console.log("*** no mobj randomly selected, probably definition error in MOBJ_TYPES");
      return "car";
   }


   /*! Create a new random mobj and add it to the lane.
    */
   new_mobj_node(lane)
   {
      // create and init new mobj and list node
      var node = new DListNode(MObjFactory.make(this.random_mobj_type()));
      // FIXME: this is not implemented nicely....avoid trucks on lanes >= 2
      for (var i = 0; lane.id >= 2 && node.data.name == "truck" && i < 10; i++) node.data = MObjFactory.make(this.random_mobj_type());
      node.data.node = node;
      node.data.lane = lane;
      node.data.d_pos = this.d_min - config_.MIN_ENTRY_POS;
      if (lane.last.prev.data == null)
         node.data.v_cur = node.data.v_max;
      else
         node.data.v_cur = lane.last.prev.data.v_cur > node.data.v_max ? node.data.v_max : lane.last.prev.data.v_cur;
      node.data.save();

      // and append it to the lane and increase mobj counter
      lane.last.insert(node);
      this.mobj_cnt++;
   }


   /*! Completely remove mobj and its list node from the game.
    */
   delete_mobj_node(node)
   {
      node.unlink();
      console.log(node.data.sim_data());

      node.data.destructor();
      node.destructor();
   }


   /*! This is the main simulation loop. It calculates next time frame of
    * simulation.
    */
   next_frame()
   {
      // evaluate keys
      switch (this.key_action)
      {
         case 'k':
         case ' ':
            this.running = !this.running;
            break;

         // clear crashes
         case 'c':
            for (var j = 0; j < this.lanes.length; j++)
               for (var node = this.lanes[j].first.next; node.data != null; node = node.next)
                  if (node.data.crash)
                     node.unlink();
            break;

         // dump current data
         case 'd':
            for (var j = 0; j < this.lanes.length; j++)
               for (var node = this.lanes[j].first.next; node.data != null; node = node.next)
                  if (node.data.t_start && node.data.t_end)
                     console.log(node.data.sim_data());
            break;

         case 's':
            if (!this.running)
               this.running = -(this.cur_frame + 1);
            break;

         case 'S':
            if (!this.running)
               this.running = -(this.cur_frame + 25);
            break;

         case '+':
            this.sim_fpd++;
            break;

         case '-':
            if (this.sim_fpd > 1)
               this.sim_fpd--;
            break;
      }
      this.key_action = "";

      if (!this.running)
         return;

      if (this.running < 0 && (-this.running <= this.cur_frame))
      {
         this.running = 0;
         return;
      }

      for (var j = 0; j < this.sim_fpd; j++, this.cur_frame++)
      {
         for (var i = 0; i < this.lanes.length; i++)
         {
            // remove mobjs which are out of scope of the lane
            for (var node = this.lanes[i].first.next; node.data != null && node.data.d_pos > this.d_max - this.d_min; /*node = node.next,*/ this.mobj_cnt--)
            {
               var dnode = node;
               node = node.next;
               this.delete_mobj_node(dnode);
            }

            // fill in new mobjs if there are less than MAX_MOBJS mobjs and the previous one is far enough
            if ((!config_.MAX_MOBJS || this.mobj_cnt < config_.MAX_MOBJS) && SRandom.rand_ev(config_.P_FILL_IN) && (this.lanes[i].last.prev.data == null || this.lanes[i].last.prev.data.d_pos >= this.d_min))
               this.new_mobj_node(this.lanes[i]);

            this.crash_cnt += this.lanes[i].recalc(this.cur_frame);
         }
      }
      this.mobj_density = this.mobj_cnt / config_.DISTANCE * 1000;

      var n = 0, v_avg = 0;
      for (var i = 0; i < this.lanes.length; i++)
      {
         v_avg += this.lanes[i].v_avg * this.lanes[i].n_sim;
         n += this.lanes[i].n_sim;
      }
      this.v_avg = v_avg / n;

      // stop simulation if there is a specific amount of simulation frames
      if (config_.MAX_FRAMES && this.cur_frame >= config_.MAX_FRAMES)
         window.clearInterval(this.timer);
   }
}


class SimDisplay
{
   constructor(canvas, ts)
   {
      this.canvas = canvas;
      this.ctx = this.canvas.getContext('2d');
      this.ts = ts;

      //! x and y scaling
      this.sx = 1;
      this.sy = 1;
      //! size of mobjs
      this.dsize = config_.DSIZE;
      //! speed curve size vars
      this.chgt = 2.0;
      this.coff = 20;
      this.cmul = 80;

      document.getElementById("dist").textContent = (ts.d_max / 1000).toFixed(1);

      this.draw_zoom = 0;
      this.z_pos = 0;
      this.z_dist = 1500;
   }

   /*! Calculate scaling of display.
    */
   scaling()
   {
      this.canvas.width = document.body.clientWidth;
      this.canvas.height = this.coff + ts.lanes.length * this.cmul * this.chgt;

      this.sx = this.canvas.width / (ts.d_max - ts.d_min * 2);
      this.sy = this.sx;
   }


   draw_axis()
   {
      // draw x-axis of speed curve
      this.ctx.strokeStyle = "grey";
      this.ctx.beginPath();
      this.ctx.moveTo(0, -MovingObject.kmh2ms(210) * this.chgt);
      this.ctx.lineTo(0, 0);
      this.ctx.lineTo(this.canvas.width, 0);
      this.ctx.stroke();

      this.ctx.font = (5 * this.chgt).toFixed(0) + "pt sans-serif";
      this.ctx.strokeStyle = "lightgrey";
      this.ctx.fillStyle = "grey";
      this.ctx.lineWidth = 0.5;
      var step = 25;
      for (var i = step; i <= 200; i += step)
      {
         this.ctx.beginPath();
         this.ctx.moveTo(0, -MovingObject.kmh2ms(i) * this.chgt);
         this.ctx.lineTo(this.canvas.width, -MovingObject.kmh2ms(i) * this.chgt);
         this.ctx.stroke();
         this.ctx.fillText(i, 10, -MovingObject.kmh2ms(i) * this.chgt + 5);
      }
   }


   /*! Draw all current moving objects.
    */
   draw()
   {
      document.getElementById("t_cur").textContent = FormatTime.hms(ts.cur_frame) + " (" + (config_.FPS * ts.sim_fpd) + "x)";
      document.getElementById("v_avg").textContent = MovingObject.ms2kmh(ts.v_avg).toFixed(1);
      document.getElementById("t_avg").textContent = FormatTime.hms(ts.t_avg);
      document.getElementById("tput").textContent = (ts.v_avg * ts.mobj_density).toFixed(1);
      document.getElementById("mobj_cnt").textContent = ts.mobj_cnt;
      document.getElementById("mobj_density").textContent = ts.mobj_density.toFixed(1);
      document.getElementById("crash_cnt").textContent = ts.crash_cnt;

      this.ctx.clearRect(0, 0, this.canvas.width, this.coff);
      this.ctx.beginPath();
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      this.ctx.rect(0, this.coff, this.canvas.width, ts.lanes.length * this.cmul * this.chgt);
      this.ctx.fill();

      for (var j = 0; j < ts.lanes.length; j++)
      {
         this.ctx.save();
         this.ctx.translate(0, this.coff + this.chgt * this.cmul * (j + 1));
         this.draw_axis();
         var y = 40 -this.cmul * this.chgt;
         this.ctx.clearRect(40, y, 550, -10);
         var lane = ts.lanes[ts.lanes.length - j - 1];
         this.ctx.fillText("n_sim=" + lane.n_sim + " v_avg=" + MovingObject.ms2kmh(lane.v_avg).toFixed(1) + " km/h t_avg=" + FormatTime.hms(lane.t_avg) + " f_sim=" + lane.f_sim.toFixed(1) + " /h r_sim=" + lane.r_sim.toFixed(1) + " /km", 40, y);
         this.ctx.restore();
      }

      this.ctx.lineWidth = 1;

      var p = 12;

      // draw road
      this.ctx.fillStyle = "lightgrey";
      this.ctx.rect(0, 20, this.canvas.width, this.dsize * ts.lanes.length);
      this.ctx.fill();

      // km lines
      for (var i = 0; i <= ts.d_max; i += 1000)
      {
         if (i == 0 || i == ts.d_max)
            this.ctx.strokeStyle = "red";
         else
            this.ctx.strokeStyle = "green";
         this.ctx.beginPath();
         this.ctx.moveTo((i -ts.d_min) * this.sx, 10);
         this.ctx.lineTo((i -ts.d_min) * this.sx, this.dsize * ts.lanes.length + 30);
         this.ctx.stroke();
      }

      for (var j = 0; j < ts.lanes.length; j++)
      {
         var i, node, mobj, x, y, l, x0;

         // draw dashed lines on the road
         if (j)
         {
            this.ctx.save();
            this.ctx.strokeStyle = "white";
            this.ctx.setLineDash([10, 10]);
            this.ctx.beginPath();
            this.ctx.moveTo(0, 20 + (ts.lanes.length - j) * this.dsize);
            this.ctx.lineTo(this.canvas.width, 20 + (ts.lanes.length - j) * this.dsize);
            this.ctx.stroke();
            this.ctx.restore();
         }

         // draw mobjs
         for (i = 0, node = ts.lanes[j].first.next; node.data != null; i++, node = node.next)
         {
            mobj = node.data;
            x = (mobj.d_pos - ts.d_min) * this.sx;
            x0 = (mobj.old.d_pos - ts.d_min) * this.sx;
            y = 20 + (ts.lanes.length - j - 1) * this.dsize;
            l = Math.max(mobj.len * this.sx, 1.0);

            // draw mobj
            this.ctx.fillStyle = this.ctx.strokeStyle = mobj.color;
            this.ctx.beginPath();
            this.ctx.rect(x, y, l, this.dsize);
            this.ctx.fill();

            // draw visibility range of mobj
            if (config_.SHOW_VIS_RANGE)
            {
               this.ctx.beginPath();
               this.ctx.moveTo(x + l, y + this.dsize * 0.5);
               this.ctx.lineTo(x + mobj.d_vis * this.sx + this.dsize, y + this.dsize * 0.5);
               this.ctx.stroke();
            }

            // draw speed curve
            this.ctx.save();
            this.ctx.translate(0, this.coff + this.chgt * this.cmul * (ts.lanes.length - j));
            this.ctx.beginPath();
            this.ctx.moveTo(x0, -mobj.old.v_cur * this.chgt);
            this.ctx.lineTo(x, -mobj.v_cur * this.chgt);
            this.ctx.stroke();
            this.ctx.restore();

            // draw crash box
            if (mobj.crash)
            {
               this.ctx.strokeStyle = "red";
               this.ctx.beginPath();
               this.ctx.rect(x - 1, y - 1, this.dsize + 2, this.dsize + 2);
               this.ctx.stroke();
            }
         }
      }

      if (this.draw_zoom)
         this.zoom_display(zctx, this.z_pos, 2000, 400, 100);
   }


   zoom_display(ctx, pos, dist, w, h)
   {
      var sx = w / dist;
      var sy = 1;//this.ts.lanes.length * 4 / h;
      var mobj, node;
      var x, y, l;
      
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "lightgrey";
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.fill();

      dist /= 2;
      for (var i = 0; i < this.ts.lanes.length; i++)
      {
         for (node = this.ts.lanes[i].first.next; node.data != null; node = node.next)
         {
            mobj = node.data;
            if (mobj.d_pos > pos + dist)
               continue;
            if (mobj.d_pos <= pos - dist)
               break;

            x = (mobj.d_pos - pos + dist) * sx;
            y = (ts.lanes.length - i) * 8 * sy;
            l = Math.max(mobj.len * sx, 1.0);

            // draw mobj
            ctx.fillStyle = ctx.strokeStyle = mobj.color;
            ctx.beginPath();
            ctx.rect(x, y, l, this.dsize);
            ctx.fill();

            // draw crash box
            if (mobj.crash)
            {
               ctx.strokeStyle = "red";
               ctx.beginPath();
               ctx.rect(x - 1, y - 1, this.dsize + 2, this.dsize + 2);
               ctx.stroke();
            }
         }
      }
   }


   key_down_handler(e)
   {
      ts.key_action = e.key;
   }


   mouse_move_handler(e)
   {
      var w = 400;
      var h = 100;
      var rect = canvas.getBoundingClientRect();
      var mousex = e.clientX - rect.left;
      var mousey = e.clientY - rect.top;
      if (mousey >= 20 && mousey < 20 + this.ts.lanes.length * this.dsize)
      {
         czoom.style.left = (mousex - w / 2) + "px";
         czoom.style.top = "40px";
         czoom.width = w;
         czoom.height = h;
         this.z_pos = mousex * (this.ts.d_max - 2 * this.ts.d_min) / this.canvas.width + this.ts.d_min;
         this.draw_zoom = 1;
      }
      else
      {
         czoom.style.left = '-10px';
         czoom.width = 0;
         czoom.height = 0;
         this.draw_zoom = 0;
      }
   }
}


var canvas = document.getElementById('raceplane');
var czoom = document.getElementById("zoomplane");
var zctx = czoom.getContext("2d");

console.log("===== NEW RUN =====");


for (var i = 0; i < config_.MOBJ_TYPES.length; i++)
   document.getElementById("desc").innerHTML += MObjFactory.desc(config_.MOBJ_TYPES[i].type) + "<br>\n";

var ts = new TrafSim();
var sd = new SimDisplay(canvas, ts);

sd.scaling();
sd.draw();

window.addEventListener('resize', function(e){sd.scaling(); sd.draw();});
document.addEventListener('keydown', function(e){sd.key_down_handler(e);});
canvas.addEventListener("mousemove", function(e){sd.mouse_move_handler(e);});
ts.timer = window.setInterval(function(){sd.draw(); ts.next_frame();}, 1000 / config_.FPS);

