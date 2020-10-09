#ifndef MOBJ_MEM_H
#define MOBJ_MEM_H

#include "trafsim.h"


mobj_t *mobj_new(void);
void mobj_free(mobj_t *mo);
int mobj_insert_behind(mobj_t *mo, mobj_t *new_mo);
int mobj_remove(mobj_t *mo);


#endif

