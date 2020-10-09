#ifndef TRAFSIM_H
#define TRAFSIM_H


typedef struct mobj
{
   //! pointer to next moving object ahead
   struct mobj *prev;
   //! pointer to next moving object behind
   struct mobj *next;
   //! current speed
   double v_cur_speed;
   //! maximum speed
   double v_max_speed;
   //! visibility range in time
   double t_vis_dist;
   //! minimum distance in time
   double t_min_dist;
   //! current position
   double d_pos;
   //! acceleration
   double a_acc;
   //! deceleration
   double a_dec;
} mobj_t;






#endif

