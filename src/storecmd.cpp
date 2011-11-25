/* -*- Mode: C; c-file-style: "stroustrup"; indent-tabs-mode:nil; -*- */

#include <stdio.h>
#include <stdlib.h>
#include <ctype.h>
#if !defined(Darwin)
#include <malloc.h>
#endif
#include <errno.h>
#include "mvstore.h"
#include "startup.h"
#include "storenotifier.h"
#include "portability.h"
#include "intr.h"
#include "storecmd.h"
#include <vector>

using namespace MVStore;

const char* storedir = NULL;
const char* const default_storeident = "test"; 

#ifdef WIN32
#define _LX_FM "%016I64X"
#else
#define _LX_FM "%016LX"
#endif

/**
 * MvStoreMgr is the manager of all store instances.
 * Note: Later on multi-store management can become much more sophisticated (e.g. open on demand etc.).
 */
class MvStoreMgr {
public:
    class MvStoreInstance {
    protected:
        MVStoreCtx storeCtx;
        MainNotificationHandler* notificationHandler;
        std::string userName;
        long volatile useCount;
        int bMVEngine;
    public:
        MvStoreInstance( char const * pUserName, char const * pUserPw, bool pAutoCreate )
        : storeCtx( 0 ), notificationHandler( 0 ), userName( pUserName ), useCount( 0 ), bMVEngine( 0 ) {
            StartupParameters params;
            std::string lStoreDir;
            params.directory = getStoreDir( pUserName, lStoreDir );
            ensuredir( params.directory );
            params.password = pUserPw;
            notificationHandler = new MainNotificationHandler();
            params.notification = notificationHandler;
            RC res = openStore( params, storeCtx );
            if ( res == RC_NOTFOUND && pAutoCreate ) {
                StoreCreationParameters create_params;
                create_params.identity = pUserName;
                create_params.password = ( pUserPw && strlen( pUserPw ) > 0 ) ? pUserPw : NULL;
                res = createStore( create_params, params, storeCtx );
                if ( res != RC_OK ) {
                    LOG_LINE(kLogError, "mvstore error %d", res);
                }
            }
        }
        MvStoreInstance( void * pStoreCtx ) : storeCtx( ( MVStoreCtx )pStoreCtx ), useCount( 0 ), bMVEngine( 1 ) {}
        ~MvStoreInstance() { if ( !bMVEngine ) { shutdownStore( storeCtx ); } delete notificationHandler; }
    public:
        long refcount() { return useCount; }
        long addref() { return InterlockedIncrement( &useCount ); }
        long release() { return InterlockedDecrement( &useCount ); }
        char const * getUserName() const { return userName.c_str(); }
        MVStoreCtx getStoreCtx() const { return storeCtx; }
        MainNotificationHandler * getNotificationHandler() const { return notificationHandler; }
    public:
        static char const * getStoreDir( char const * pUserName, std::string & pResult )
        {
            pResult = storedir;
            if ( pResult[ pResult.length() - 1 ] != '/' && pResult[ pResult.length() - 1 ] != '\\' )
                pResult += "/";
            pResult += pUserName;
            return pResult.c_str();
        }
    };
protected:
    typedef std::vector<MvStoreInstance *> TStores; /* Note: Later, could be sorted/arranged differently (by identity and/or by storectx). */
    Mutex storesLock;
    TStores stores;
public:
    MvStoreMgr() {}
    ~MvStoreMgr() {
        for ( TStores::const_iterator iS = stores.begin(); stores.end() != iS; iS++ ) {
            delete *iS;
        }
        stores.clear();
    }

    // beginUseInstance - endUseInstance
    // This interface sets up the caller to facilitate on-demand load/unload later on;
    // allows recursion.
    MVStoreCtx beginUseInstance( char const * pUserName, char const * pUserPw, bool pAutoCreate ) {
        if ( !pUserName ) {
            pUserName = default_storeident;
        }
        MvStoreInstance * lInst = findByName( pUserName );
        if ( !lInst ) {
            lInst = new MvStoreInstance( pUserName, pUserPw, pAutoCreate );
            stores.push_back( lInst );
        }
        lInst->addref();
        return lInst->getStoreCtx();
    }
    MVStoreCtx beginUseInstance( void * pStoreCtx ) {
        MvStoreInstance * lInst = findByStore( ( MVStoreCtx )pStoreCtx );
        if ( !lInst ) {
            lInst = new MvStoreInstance( ( MVStoreCtx )pStoreCtx );
            stores.push_back( lInst );
        }
        lInst->addref();
        return lInst->getStoreCtx();
    }
    void endUseInstance( MVStoreCtx pStoreCtx ) {
        MvStoreInstance * lI = findByStore( ( MVStoreCtx )pStoreCtx );
        if ( lI && 0 == lI->release() ) {
            #if 0
                // Review:
                //   For now we just keep the store until it may be reused soon after;
                //   a nicer approach will be to shutdown after some timeout (reset by any
                //   use in the meantime).
                stores.erase( ... );
                delete lI;
            #endif
        }
    }
    bool dropInstance( char const * pUserName, char const * pUserPw ) {
        if ( !pUserName ) {
            pUserName = default_storeident;
        }
        MvStoreInstance * lI = findByName( pUserName, true );
        if ( lI && ( 0 == lI->refcount() || 0 == lI->release() ) ) {
            delete lI;
            lI = NULL;
        }
        if ( !lI ) {
            // REVIEW: If drop is called at startup, after unclean shutdown, this code doesn't delete the logs...
            std::string lStoreFN;
            MvStoreInstance::getStoreDir( pUserName, lStoreFN );
            lStoreFN += "/mv.store";
            unlink( lStoreFN.c_str() );
            return true;
        }
        return false;
    }

public:
    static ISession * haveSession( mvs_connection_ctx_t * pCCtx ) {
        if ( pCCtx->session ) {
            return ( ISession* )pCCtx->session;
        }
        if ( !pCCtx->storectx ) {
            LOG_LINE(kLogError, "invalid state (no storectx)");
            return NULL;
        }
        pCCtx->session = ISession::startSession( ( MVStoreCtx )pCCtx->storectx, pCCtx->storeident, pCCtx->storepw );
        return ( ISession* )pCCtx->session;
    }
    MvStoreInstance * findByName( char const * pUserName, bool pDrop=false ) {
        if ( !pUserName ) {
            LOG_LINE(kLogError, "invalid argument");
            return NULL;
        }
        MutexP const lLock( &storesLock );
        for ( TStores::iterator iS = stores.begin(); stores.end() != iS; iS++) {
            if ( 0 == strcmp( ( *iS )->getUserName(), pUserName ) ) {
                MvStoreInstance * lI = *iS;
                if ( pDrop ) {
                    stores.erase( iS );
                }
                return lI;
            }
        }
        return NULL;
    }
    MvStoreInstance * findByStore( MVStoreCtx pStoreCtx ) {
        if ( !pStoreCtx ) {
            LOG_LINE(kLogError, "invalid argument");
            return NULL;
        }
        MutexP const lLock( &storesLock );
        for ( TStores::const_iterator iS = stores.begin(); stores.end() != iS; iS++ ) {
            if ( ( *iS )->getStoreCtx() == pStoreCtx ) {
                return *iS;
            }
        }
        return NULL;
    }
};

void strerror( RC rc, ISession& sess, CompilationError& ce, 
               char*& res, size_t& len ) {
    if ( rc == RC_SYNTAX && ce.msg ) {
        if ( !res ) {
            len = ce.pos+strlen(ce.msg)+50;
            res = (char*)sess.alloc( len+1 );
        }
        len = snprintf( res, len, "%*s\nSyntax: %s at %d, line %d\n", 
                        ce.pos+2, "^", ce.msg, ce.pos, ce.line );
    } else if ( rc != RC_OK ) {
        if ( !res ) {
            len = 50; res = (char*)sess.alloc( len+1 );
        }
        len = snprintf( res, len, "Mvstore error: (%d)\n", rc );
    }
}

#define DIGITS "0123456789"

void str2value( ISession& sess, Value* vals, 
                char** params, unsigned nparams ) {
    RC rc;
    
    for ( unsigned i = 0; i < nparams; i++ ) {
        char* p = params[i];
        Value& v = vals[i];
        if ( !p ) {                 /* NULL */
            v.setError();
        } else {
            CompilationError lCE;
            /* the store kernel can do this now, so below code obsoleted */
            rc = sess.parseValue( p, strlen(p), v, &lCE );
            if ( rc != RC_OK ) { v.setError(); }
        } 
    }
}

#define MAX_ALLOCA 10240

#define ALLOCA( se, n, sz, yes )                                        \
    ( (*(yes)=((n)*(sz)>MAX_ALLOCA) ) ? (se)->alloc( (n)*(sz) ) :       \
      alloca( (n)*(sz) ) )
#define AFREE( se, yes, ptr ) \
    do { if ( (yes) && (ptr) ) { (se)->free(ptr); } } while (0)

RC mvs_expr2jsoni( ISession& sess, const char* pExpr, 
                   char*& pErr, size_t& len, 
                   char** params, unsigned nparams,
                   Value** v ) {
    LOG_LINE(kLogDebug, "expression:\n%s", pExpr); 
    CompilationError lCE;

    if ( !v ) { return RC_INTERNAL; }
    int alloc;

    Value* vals = (Value*)ALLOCA( &sess, nparams, sizeof(Value), &alloc );
    str2value( sess, vals, params, nparams );

    IExpr *const expr = sess.createExpr(pExpr, NULL, 0, &lCE);

    AFREE( &sess, alloc, vals );
    if ( !expr ) { strerror( RC_SYNTAX, sess, lCE, pErr, len ); }

    *v = (Value*)sess.alloc( sizeof( Value ) );
    const RC rc = expr->execute( **v, vals, nparams ); 
    if ( rc != RC_OK ) {
        LOG_LINE(kLogError, "mvstore error %d", rc);
    } else {
        sess.convertValue( **v, **v, VT_STRING );
    }

    return rc;
}

RC mvs_sql2jsoni( ISession& sess, const char* pCmd, 
                  char*& pResult, size_t& len, 
                  char** params, unsigned nparams,
                  unsigned off = 0, unsigned lim = ~0u ) {
    LOG_LINE(kLogDebug, "command:\n%s", pCmd); 
    CompilationError lCE;

    int alloc;

    Value* vals = (Value*)ALLOCA( &sess, nparams, sizeof(Value), &alloc );
    str2value( sess, vals, params, nparams );

    const RC rc = sess.execute( pCmd, strlen(pCmd), &pResult, NULL, 0, 
                                vals, nparams, &lCE, NULL, lim, off );
    AFREE( &sess, alloc, vals );
    if ( rc != RC_OK ) { strerror( rc, sess, lCE, pResult, len ); }

    return rc;
}

ssize_t mvs_sql2rawi( ISession& sess, mvs_stream_t* pCtx, 
                      const char* pCmd, char*& pResult, Twriter pWriter,
                      char** params, unsigned nparams,
                      unsigned offset = 0, unsigned limit = ~0u ) {
    LOG_LINE(kLogDebug, "command:\n%s", pCmd); 
    CompilationError lCE;
    IStmt *const stmt = sess.createStmt(pCmd, NULL, 0, &lCE);

    if ( !stmt ) {
        char* err = NULL;
        size_t len;
        strerror( RC_SYNTAX, sess, lCE, err, len );
        LOG_LINE(kLogError, err);
        sess.free( err );
        return (ssize_t)-1;
    }

    int alloc;
    Value* vals = (Value*)ALLOCA( &sess, nparams, sizeof(Value), &alloc );
    str2value( sess, vals, params, nparams );
    IStreamOut* out = NULL;
    RC res = stmt->execute( out, vals, nparams, limit, offset );
    AFREE( &sess, alloc, vals );
    //if ( res == RC_SYNTAX && lCE.msg)
    //    printf("%*s\nSyntax: %s at %d, line %d\n", lCE.pos+2, "^", 
    //    lCE.msg, lCE.pos, lCE.line);
    ssize_t off = 0;
    if ( res != RC_OK ) {
        LOG_LINE(kLogError, "mvstore error %d", res);
    } else {
#ifdef STREAM_CLOSE
        unsigned char buf[0x1000];
        size_t got = 0x1000;
        while ( !intr && (res = out->next(buf, got)) == RC_OK ) {
            if ( (*pWriter)(pCtx, buf, got) < (ssize_t)got ) {
                LOG_LINE(kLogWarning, "failed to write %lu bytes (read from the store) to the socket", (unsigned long)got);
                res = RC_OTHER;
                break;
            }
            got = 0x1000;
        }
        out->destroy();
#else
        unsigned len = 0x1000;
        unsigned char* buf = (unsigned char*)sess.alloc( len );
        size_t got = len;
        if ( buf == NULL ) { 
            res = RC_OTHER; 
        } else {
            while ( !intr && (res = out->next(buf+off, got)) == RC_OK ) {
                off += got;
                if ( len - off < len/2 ) {
                    len += len/2;
                    buf = (unsigned char*)sess.realloc( buf, len );
                    if ( buf == NULL ) { res = RC_OTHER; break; }
                }
                got = len - off;
            }
        }
        out->destroy();
        pResult = (char*)buf;
#endif
    }
    stmt->destroy();
    return (res == RC_OK || res == RC_EOF) ? off : size_t(-1);
}

/*
class MvReader : public IStreamIn
{
    protected:
        void *const mReaderCtx;
        const Treader mReader;
    public:
        MvReader(void * pReaderCtx, Treader pReader) : mReaderCtx(pReaderCtx), mReader(pReader) {}
        virtual RC next(unsigned char *buf,size_t lBuf) { if (mReader && (*mReader)(mReaderCtx, buf, lBuf) > 0) return RC_OK; return RC_FALSE; }
        virtual void destroy() { delete this; }
};
*/

class WriterIStreamIn : public IStreamIn {
    Twriter writer;
    mvs_stream_t* ctx;
protected:
    WriterIStreamIn() {}
public:
    WriterIStreamIn( Twriter& w, mvs_stream_t* c ) { writer = w; ctx = c; }
    virtual RC next( const unsigned char *buf, size_t len ) {
        ssize_t wrote = writer( ctx, buf, len );
        if ( wrote < 0 || (size_t)wrote < len ) {
            return RC_OTHER;
        }
        return RC_OK;
    }

    virtual void destroy( void ) {}
};

int mvs_raw2rawi( ISession& sess, mvs_stream_t* ctx, 
                  Treader reader, Twriter writer ) {
    // For the moment this is limited to raw in, simple ack out.

    IStreamIn *in = NULL;
    WriterIStreamIn out( writer, ctx );
    if ( !reader || sess.createInputStream( in, &out ) != RC_OK ) {
        return 0;
    }

    unsigned char buf[0x1000];
    ssize_t lRead = 1, got = 0, use, need;
    RC res = RC_OK;
    if ( ctx->len > 0 ) {
        use = ctx->clen > 0 ? ( MIN( ctx->clen, ctx->len ) ) : ctx->len;
        res = in->next( (unsigned char*)ctx->buf, use );
        got += use;
        ctx->len -= use;
    }
    while ( !intr && res == RC_OK && lRead > 0 && ( ctx->clen >= 0 ? got < (ssize_t)ctx->clen : 1 ) ) {
        need = ctx->clen >= got ? ctx->clen - got : sizeof(buf);
        lRead = reader( ctx, buf, MIN( need, (ssize_t)sizeof(buf) ) );
        if ( lRead > 0 ) {
            got += lRead;
            res = in->next( buf, lRead );
        }
    }
    if ( lRead < 0 ) { res = RC_OTHER; }
    /* this completes a pin insertion */
    if ( res == RC_OK ) { res = in->next( NULL, 0 ); }
    in->destroy();

    return (res == RC_OK) ? 1 : 0;
}

extern "C"
{
    void* mvs_init( void* storectx ) { 
        MvStoreMgr* mgr = new MvStoreMgr();
        if ( storectx ) { /* store instance from mvEngine */
            mgr->beginUseInstance( storectx );
        }
        return mgr;
    }

    void mvs_term( void *mgrp ) { 
        if ( mgrp ) { delete (MvStoreMgr *)mgrp; }
    }

    mvs_connection_ctx_t* mvs_init_connection( void* mgrp, const char* storeident, const char* storepw ) {
        if ( !mgrp ) {
            LOG_LINE(kLogError, "invalid arguments");
            return NULL;
        }
        if ( !storeident ) {
            storeident = default_storeident;
        }
        LOG_LINE(kLogDebug, "connection for: %s", storeident);
        mvs_connection_ctx_t* cctxp = new mvs_connection_ctx_t;
        memset( cctxp, 0, sizeof( mvs_connection_ctx_t ) );
        cctxp->mgr = mgrp;
        size_t l = 1 + strlen( storeident );
        cctxp->storeident = new char[ l ];
        memcpy( cctxp->storeident, storeident, l );
        if ( storepw ) {
            l = 1 + strlen( storepw );
            cctxp->storepw = new char[ l ];
            memcpy( cctxp->storepw, storepw, l );
        }
        cctxp->storectx = ( ( MvStoreMgr* )mgrp )->beginUseInstance( storeident, storepw, true );
        return cctxp;
    }
    
    void mvs_term_connection( mvs_connection_ctx_t* cctxp ) {
        if ( !cctxp ) {
            LOG_LINE(kLogError, "invalid arguments");
            return;
        }
        if ( cctxp->session ) {
            ( ( ISession* )cctxp->session )->terminate();
        }
        if ( cctxp->storectx ) {
            ( ( MvStoreMgr* )cctxp->mgr )->endUseInstance( ( MVStoreCtx )cctxp->storectx );
        }
        delete [] cctxp->storeident;
        delete [] cctxp->storepw;
        delete cctxp;
    }
    
    int mvs_drop_store( void* mgrp, const char* storeident, const char* storepw ) {
        if ( !mgrp ) {
            LOG_LINE(kLogError, "invalid arguments");
            return 1;
        }
        return ( ( MvStoreMgr* )mgrp )->dropInstance( storeident, storepw ) ? 0 : 1;
    }

    int mvs_expr2json( mvs_connection_ctx_t* cctxp,
                       const char* pCmd, 
                       char** ppError, size_t* len, 
                       char** params, unsigned nparams,
                       void** ppValue ) {
        ISession* sess = MvStoreMgr::haveSession( cctxp );
        if ( !sess ) { return 0; }
        size_t ignore = 0;
        if ( ppError == NULL ) { return 0; }
        char*& pError = *ppError;
        if ( len == NULL ) { len = &ignore; }
        RC res = mvs_expr2jsoni( *sess, pCmd, pError, *len, 
                                params, nparams, (Value**)ppValue );
        return res == RC_OK ? 1 : 0;
    }

    int mvs_sql2json( mvs_connection_ctx_t* cctxp,
                      const char* pCmd, 
                      char** ppResult, size_t* len, 
                      char** params, unsigned nparams,
                      unsigned off, unsigned lim ) {
        ISession* sess = MvStoreMgr::haveSession( cctxp );
        if ( !sess ) { return 0; }
        size_t ignore = 0;
        if ( ppResult == NULL ) { return 0; }
        char*& pResult = *ppResult;
        if ( len == NULL ) { len = &ignore; }
        RC res = mvs_sql2jsoni( *sess, pCmd, pResult, *len, 
                                params, nparams, off, lim );

        return res == RC_OK ? 1 : 0;
    }

    ssize_t mvs_sql2raw( mvs_connection_ctx_t* cctxp,
                         const char* qry, char** ppResult, 
                         mvs_stream_t* ctx, Twriter writer,
                         char** params, unsigned nparams,
                         unsigned off, unsigned lim ) {
        ISession* sess = MvStoreMgr::haveSession( cctxp );
        if ( !sess ) { return 0; }
        char*& pResult = *ppResult;
        ssize_t res = mvs_sql2rawi( *sess, ctx, qry, pResult, writer, 
                                    params, nparams, off, lim );
        return res;
    }

    int mvs_raw2raw( mvs_connection_ctx_t* cctxp,
                     mvs_stream_t* pCtx, Treader pReader, Twriter pWriter ) {
        ISession* sess = MvStoreMgr::haveSession( cctxp );
        int res = mvs_raw2rawi(*sess, pCtx, pReader, pWriter);
        return res;
    }

    int mvs_sql2count( mvs_connection_ctx_t* cctxp,
                       const char* query, char** res, size_t* len,
                       char** params, unsigned nparams, uint64_t* count ) {
        ISession* sess = MvStoreMgr::haveSession( cctxp );
        if ( !sess ) { return 0; }
        if ( !count ) { return 0; }
        *count = 0;

        CompilationError ce;
        IStmt *const stmt = sess->createStmt( query, NULL, 0, &ce );

        if ( !stmt ) {
            size_t llen = len ? *len : 0;
            strerror( RC_SYNTAX, *sess, ce, *res, llen );
            return 0;
        }

        int alloc;
        Value* vals = (Value*)ALLOCA( sess, nparams, sizeof(Value), &alloc );
        str2value( *sess, vals, params, nparams );

        RC rc = stmt->count( *count, vals, nparams );
        AFREE( sess, alloc, vals );
        if ( rc != RC_OK ) {
            size_t llen = len ? *len : 0;
            strerror( rc, *sess, ce, *res, llen );
            return rc == RC_OK ? 1 : 0;
        }
        return 1;
    }

    int mvs_sql2plan( mvs_connection_ctx_t* cctxp,
                      const char* query, char** res,
                      char** params, unsigned nparams ) {
        ISession* sess = MvStoreMgr::haveSession( cctxp );
        if ( !sess ) { return 0; }
        CompilationError ce;
        IStmt *const stmt = sess->createStmt( query, NULL, 0, &ce );

        size_t len = 0;
        if ( !stmt ) {
            strerror( RC_SYNTAX, *sess, ce, *res, len );
            return 0;
        }

        int alloc;
        Value* vals = (Value*)ALLOCA( sess, nparams, sizeof(Value), &alloc );

        str2value( *sess, vals, params, nparams );

        RC rc = stmt->analyze( *res, vals, nparams );
        AFREE( sess, alloc, vals );
        if ( rc != RC_OK ) {
            strerror( rc, *sess, ce, *res, len );
            return rc == RC_OK ? 1 : 0;
        }
        /* workaround - anaylze of insert? */
        if ( rc == RC_OK && *res == NULL ) { 
            *res = (char*)sess->alloc( strlen("insert")+1 );
            strcpy( *res, "insert" );
        }
        return 1;
    }
    
    int mvs_sql2display( mvs_connection_ctx_t* cctxp,
                         const char* query, char** res ) {
        ISession* sess = MvStoreMgr::haveSession( cctxp );
        if ( !sess ) { return 0; }
        CompilationError ce;
        IStmt *const stmt = sess->createStmt( query, NULL, 0, &ce );

        size_t len = 0;
        if ( !stmt ) {
            strerror( RC_SYNTAX, *sess, ce, *res, len );
            return 0;
        }

        *res = stmt->toString(); /* this can be NULL */

        return 1;
    }

    int mvs_regNotif( mvs_connection_ctx_t* cctxp,
                      const char* type, const char* notifparam, 
                      const char* clientid, char **res ) {
        MainNotificationHandler* const mainh = ((MvStoreMgr*)cctxp->mgr)->findByStore((MVStoreCtx)cctxp->storectx)->getNotificationHandler();
        ISession* const sess = MvStoreMgr::haveSession(cctxp);
        return ( mainh && RC_OK == mvs_regNotifi( *mainh, *sess, type, notifparam, clientid, res ) ) ? 1 : 0;
    }

    int mvs_unregNotif( mvs_connection_ctx_t* cctxp,
                        const char* notifparam, const char* clientid, 
                        char **res ) {
        MainNotificationHandler* const mainh = ((MvStoreMgr*)cctxp->mgr)->findByStore((MVStoreCtx)cctxp->storectx)->getNotificationHandler();
        ISession* const sess = MvStoreMgr::haveSession(cctxp);
        return ( mainh && RC_OK == mvs_unregNotifi( *mainh, *sess, notifparam, clientid, res ) ) ? 1 : 0;
    }

    int mvs_waitNotif( mvs_connection_ctx_t* cctxp,
                       const char* notifparam, const char* clientid, 
                       int timeout, char **res ) {
        MainNotificationHandler* const mainh = ((MvStoreMgr*)cctxp->mgr)->findByStore((MVStoreCtx)cctxp->storectx)->getNotificationHandler();
        ISession* const sess = MvStoreMgr::haveSession(cctxp);
        return ( mainh && RC_OK == mvs_waitNotifi( *mainh, *sess, notifparam, clientid, timeout, res ) ) ? 1 : 0;
    }

    /* Plumbing (may remove later). */
    void mvs_free( mvs_connection_ctx_t* cctxp, void* ptr ) {
        ISession* sess = (ISession*)cctxp->session;
        if ( !sess ) { return; }
        sess->free( ptr );
    }
    void mvs_freev( mvs_connection_ctx_t* cctxp, void* v ) {
        ISession* sess = (ISession*)cctxp->session;
        if ( !sess ) { return; }
        sess->freeValue( *(Value*)v );
        sess->free( v );
    }
    const char* mvs_val2str( void* pValue ) { return ((Value*)pValue)->str; }
    uint32_t mvs_val2len( void* pValue ) { return ((Value*)pValue)->length; }
};
