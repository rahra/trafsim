#include <stdio.h>
#include <stdlib.h>

#include "smlog.h"
#include "trafsim.h"


/*! Allocate a new mobj_t structure and initialize with 0.
 * @return The function returns a valid pointer to a mobj_t structure. If
 * memory allocation failes it does not return but call exit(3) instead.
 */
mobj_t *mobj_new(void)
{
   mobj_t *mo;

   if ((mo = calloc(1, sizeof(*mo))) == NULL)
      log_errno_exit(LOG_ERR, "calloc() failed");

   return mo;
}


/*! Free mobj_t structure.
 */
void mobj_free(mobj_t *mo)
{
   free(mo);
}


/* Insert the object new_mo directly behind mo.
 */
int mobj_insert_behind(mobj_t *mo, mobj_t *new_mo)
{
   // safety check
   if (mo == NULL || new_mo == NULL)
   {
      log_msg(LOG_ERR, "null pointer caught");
      return -1;
   }

   // insert mobj into double-linked list
   new_mo->next = mo->next;
   new_mo->prev = mo;
   mo->next = new_mo;
   new_mo->next->prev = new_mo;

   return 0;
}


/*! Remove object from double linked list.
 */
int mobj_remove(mobj_t *mo)
{
   // safety check
   if (mo == NULL)
   {
      log_msg(LOG_ERR, "null pointer caught");
      return -1;
   }

   // check if one is ahead
   if (mo->prev != NULL)
      mo->prev->next = mo->next;
   // check if one is behind
   if (mo->next != NULL)
      mo->next->prev = mo->prev;

   return 0;
}

