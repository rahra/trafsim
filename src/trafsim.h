#ifndef TRAFSIM_H
#define TRAFSIM_H


typedef struct mobj
{
   //! pointer to next moving object ahead
   struct mobj *prev;
   //! pointer to next moving object behind
   struct mobj *next;
   //! id
   int id;
   //! current speed
   double v_cur;
   //! maximum speed
   double v_max;
   //! max speed difference on approaching a mobj ahead
   double v_diff;
   //! visibility range in time
   double t_vis;
   //! minimum distance in time
   double t_min;
   //! current position
   double d_pos;
   //! acceleration
   double a_acc;
   //! deceleration
   double a_dec;
   //! 1 if crash
   int crash;
} mobj_t;


#endif

