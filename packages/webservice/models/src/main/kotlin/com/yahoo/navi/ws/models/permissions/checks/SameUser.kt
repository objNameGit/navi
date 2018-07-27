package com.yahoo.navi.ws.models.permissions.checks

import com.yahoo.navi.ws.models.beans.User
import com.yahoo.elide.security.ChangeSpec
import com.yahoo.elide.security.RequestScope
import com.yahoo.elide.security.checks.CommitCheck
import com.yahoo.elide.security.checks.OperationCheck

import java.security.Principal
import java.util.Optional

/**
 * Checks that record id matches user id
 */
object SameUser {

    /**
     * @param record user
     * @param requestScope Elide Resource
     * @param changeSpec Elide Resource
     * @return true if given record id matches user's id
     */
    private fun check(record: User, requestScope: RequestScope, changeSpec: Optional<ChangeSpec>): Boolean {
        val user = requestScope.user.opaqueUser as Principal
        val recordId = record.id
        val bouncerId = user.name

        return recordId == bouncerId
    }

    /**
     * Checks at the operation level
     */
    class AtOperation : OperationCheck<User>() {

        /**
         * @param record user
         * @param requestScope Elide Resource
         * @param changeSpec Elide Resource
         * @return true if given record id matches user's id
         */
        override fun ok(record: User, requestScope: RequestScope, changeSpec: Optional<ChangeSpec>): Boolean {
            return check(record, requestScope, changeSpec)
        }
    }

    /**
     * Checks at the commit level
     */
    class AtCommit : CommitCheck<User>() {

        /**
         * @param record user
         * @param requestScope Elide Resource
         * @param changeSpec Elide Resource
         * @return
         */
        override fun ok(record: User, requestScope: RequestScope, changeSpec: Optional<ChangeSpec>): Boolean {
            return check(record, requestScope, changeSpec)
        }
    }
}