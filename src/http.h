/* -*- Mode: C; c-file-style: "stroustrup"; indent-tabs-mode:nil; -*- */

#if !defined( _http_h )
#define _http_h

#include "portability.h"

#if defined( __cplusplus )
extern "C" {
#endif

    /* both encode & decode support inplace edit s == d, s == e */
    ssize_t url_decode( const char* s, char* d, size_t dlen );
    size_t url_encode_len( const char* d, size_t blen, size_t* dlen );
    ssize_t url_encode( const char* d, char* e, size_t elen, size_t *odlen );

    char* http_parse( char* headers, const char* header, size_t hlen, 
                      char* undo, char** end );
#define undo_parse( undo, end ) (*(end) = (undo))

    const char* ltime( void );

#define CRLF "\r\n"
#define GET "GET"
#define POST "POST"
#define HTTP "HTTP/1.1 "
#define LENGTH "Content-Length: "
#define TRANSFER "Transfer-Encoding: "
#define TYPE "Content-Type: "
#define CONNECTION "Connection: "
#define AUTH "Authorization: "
#define BASIC "Basic"
#define CHUNKED "chunked"
#define CLOSE "close"
#define WWW_AUTH "WWW-Authenticate: "

#define HTTP_OK 200
#define HTTP_OK_DESC "OK"

#define HTTP_BAD 400
#define HTTP_BAD_DESC "Bad Request"

#define HTTP_UNAUTH 401
#define HTTP_UNAUTH_DESC "Unauthorized"

#define HTTP_FORBID 403
#define HTTP_FORBID_DESC "Forbidden"

#define HTTP_NOT_FOUND 404
#define HTTP_NOT_FOUND_DESC "Not Found"

#define HTTP_LEN_REQD 411
#define HTTP_LEN_REQD_DESC "Length Required"

#define HTTP_LARGE 413
#define HTTP_LARGE_DESC "Request Entity Too Large"

#define HTTP_INT 500
#define HTTP_INT_DESC "Internal Server Error"

#define HTTP_UNIMPL 501
#define HTTP_UNIMPL_DESC "Not Implemented"

#define HTTP_UNAVAIL 503
#define HTTP_UNAVAIL_DESC "Service Unavailable"

#define CGI_SEP "/?"

#define MIME_HTML "text/html"
#define MIME_JSCRIPT "application/javascript"
#define MIME_ICO "image/x-icon"
#define MIME_GIF "image/gif"
#define MIME_JPG "image/jpeg"
#define MIME_PNG "image/png"

#define MIME_URL "application/x-www-form-urlencoded"
#define MIME_JSON "application/json"
#define MIME_CSS "text/css"
#define MIME_PROTO "application/x-protobuf"
#define MIME_OCTET "application/octet-stream"

#if defined( __cplusplus )
}
#endif

#endif
