
//! simulation frames per redraw
const SIM_FPD = 1;
//! maximum number of mobjs in the game (0 for unlimited)
const MAX_MOBJS = 0;
//! new mobjs do not enter befor MIN_ENTRY_POS meters
const MIN_ENTRY_POS = 300;
/*! Probability that a new mobj fills in if MIN_ENTRY_POS is ok. This controls
 * the traffic density. */
const P_FILL_IN = 0.3;
//! maximum frames to calculate (0 for unlimited)
const MAX_FRAMES = 0;
//! use Math.random() as PRNG
const USE_MATH_RANDOM = 0;
//! mobj failure probability per hour
const MOBJ_FAIL = 0.0;
//! absolute minimum distance
const MOBJ_D_MIN = 10;
//! course distance
const DISTANCE = 25000;
//! number of lanes
const NUM_LANES = 3;
//! distribution of mobj types
const MOBJ_TYPES = [
   {type: "car", p: 0.35},
   {type: "truck", p: 0.3},
   {type: "bike", p: 0.01},
   {type: "blocking", p: 0.29},
   {type: "aggressive", p: 0.05},
];
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
      if (USE_MATH_RANDOM)
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
      s = t % 60;

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


   recalc(t_cur)
   {
      //! max number of iterations to prevent endless loop
      const MAX_LOOP = 10;
      var crash_cnt = 0;

      this.integrity();
      // loop as long as no lane change appeared (because of changes in the linked list)
      for (var node = this.first.next, i = 0; node.data != null && i < MAX_LOOP; i++)
      {
         // loop over all elements in the list
         for (; node.data != null; node = node.next)
         {
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
   constructor(canvas, rlen = DISTANCE)
   {
      this.canvas = canvas;

      this.lanes = [];
      this.timer = null;

      this.t_frame = 1;
      this.ctx = this.canvas.getContext('2d');
      this.cur_frame = 0;

      this.sx = 1;
      this.sy = 1;

      this.d_max = rlen;
      document.getElementById("dist").textContent = (this.d_max / 1000).toFixed(1);
      this.d_min = 0;

      this.mobj_cnt = 0;
      this.crash_cnt = 0;

      this.avg_speed = 0;
      this.avg_cnt = 0;

      this.running = 1;

      this.init_lanes();
   }


   init_lanes()
   {
      for (var i = 0; i < NUM_LANES; i++)
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


   /*! Calculate scaling of display.
    */
   scaling()
   {
      this.canvas.width = document.body.clientWidth;
      this.canvas.height = 300; //window.innerHeight;

      this.sx = this.canvas.width / (this.d_max - this.d_min);
      //this.sy = this.canvas.height / 100;
      this.sy = this.sx;
   }


   random_mobj_type()
   {
      var rnd = SRandom.rand();
      for (var i = 0; i < MOBJ_TYPES.length; i++)
      {
         if (rnd < MOBJ_TYPES[i].p)
            return MOBJ_TYPES[i].type;
         rnd -= MOBJ_TYPES[i].p;
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
      node.data.node = node;
      node.data.lane = lane;
      node.data.t_init = this.cur_frame;
      node.data.save();

      // and append it to the lane and increase mobj counter
      lane.last.insert(node);
      this.mobj_cnt++;
   }


   /*! Completely remove mobj and its list node from the game.
    */
   delete_mobj_node(node)
   {
      const MAX_AVG_CNT = 1000;
      var div = this.avg_cnt < MAX_AVG_CNT ? this.avg_cnt : MAX_AVG_CNT;
      node.unlink();
      this.avg_speed = (this.avg_speed * div + MovingObject.ms2kmh(node.data.d_pos / (this.cur_frame - node.data.t_init))) / (div + 1);
      this.avg_cnt++;
   }


   /*! This is the main simulation loop. It calculates next time frame of
    * simulation.
    */
   next_frame()
   {
      if (!this.running)
         return;

      if (this.running < 0 && (-this.running <= this.cur_frame))
      {
         this.running = 0;
         return;
      }

      for (var j = 0; j < SIM_FPD; j++, this.cur_frame++)
      {
         for (var i = 0; i < this.lanes.length; i++)
         {
            // remove mobjs which are out of scope of the lane
            for (var node = this.lanes[i].first.next; node.data != null && node.data.d_pos > this.d_max; node = node.next, this.mobj_cnt--)
               this.delete_mobj_node(node);

            // fill in new mobjs on 1st and 2nd lane if there are less than MAX_MOBJS mobjs and the previous one is far enough
            if ((i <= 1) && (!MAX_MOBJS || this.mobj_cnt < MAX_MOBJS) && SRandom.rand_ev(P_FILL_IN) && (this.lanes[i].last.prev.data == null || this.lanes[i].last.prev.data.d_pos > MIN_ENTRY_POS))
               this.new_mobj_node(this.lanes[i]);

            this.crash_cnt += this.lanes[i].recalc(this.cur_frame);
         }
      }

      // stop simulation if there is a specific amount of simulation frames
      if (MAX_FRAMES && this.cur_frame >= MAX_FRAMES)
         window.clearInterval(this.timer);
   }


   /*! Draw all current moving objects.
    */
   draw()
   {
      document.getElementById("t_cur").textContent = FormatTime.hms(this.cur_frame);
      document.getElementById("avg_speed").textContent = this.avg_speed.toFixed(1);
      document.getElementById("tput").textContent = (this.avg_cnt / this.cur_frame * 3600).toFixed(1);
      document.getElementById("mobj_cnt").textContent = this.mobj_cnt;
      document.getElementById("crash_cnt").textContent = this.crash_cnt;

      this.ctx.clearRect(0, 0, this.canvas.width, 100);
      this.ctx.beginPath();
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      this.ctx.rect(0, 100, this.canvas.width, 200);
      this.ctx.fill();

      this.ctx.lineWidth = 1;

      var p = 3;

      for (var j = 0; j < this.lanes.length; j++)
      {
         var i, node, mobj;
         for (i = 0, node = this.lanes[j].first.next; node.data != null; i++, node = node.next)
         {
            mobj = node.data;

            // draw mobj
            //this.ctx.fillStyle = this.ctx.strokeStyle = X11Colors[mobj.id*179%X11Colors.length].val;
            this.ctx.fillStyle = this.ctx.strokeStyle = mobj.color;
            this.ctx.beginPath();
            this.ctx.rect((mobj.d_pos - this.d_min) * this.sx, 20 + (this.lanes.length - j - 1) * 5, p, p);
            this.ctx.fill();

            // draw visibility range of mobj
            this.ctx.beginPath();
            this.ctx.moveTo((mobj.d_pos - this.d_min) * this.sx + p, 20 + (this.lanes.length - j - 1) * 5 + p * 0.5);
            this.ctx.lineTo((mobj.d_pos - this.d_min + mobj.d_vis) * this.sx + p, 20 + (this.lanes.length - j - 1) * 5 + p * 0.5);
            this.ctx.stroke();

            // draw speed curve
            this.ctx.beginPath();
            this.ctx.moveTo((mobj.old.d_pos - this.d_min) * this.sx, 300 - mobj.old.v_cur * 3);
            this.ctx.lineTo((mobj.d_pos - this.d_min) * this.sx, 300 - mobj.v_cur * 3);
            this.ctx.stroke();

            // draw crash box
            if (mobj.crash)
            {
               this.ctx.strokeStyle = "red";
               this.ctx.beginPath();
               this.ctx.rect((mobj.d_pos - this.d_min) * this.sx - 1, 20 + (this.lanes.length - j - 1) * 5 - 1, p+2, p+2);
               this.ctx.stroke();
            }
         }
      }
   }


   key_down_handler(e)
   {
      switch (e.key)
      {
         case ' ':
            this.running = !this.running;
            break;

         case 's':
            if (!this.running)
               this.running = -(this.cur_frame + 1);
            break;

         case 'S':
            if (!this.running)
               this.running = -(this.cur_frame + 25);
            break;

      }
   }
}


var canvas = document.getElementById('raceplane');

console.log("===== NEW RUN =====");

var ts = new TrafSim(canvas);

ts.scaling();
ts.draw();

window.addEventListener('resize', function(e){ts.scaling(); ts.draw();});
document.addEventListener('keydown', function(e){ts.key_down_handler(e);});
ts.timer = window.setInterval(function(){ts.draw(); ts.next_frame();}, 40);


