import React, { useState, useEffect } from "react";

function App() {
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [tracksPerPlaylists, setTracksPerPlaylists] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [importedData,setImportedData] = useState([]);

  const [checked,setChecked] = useState([]);

  const clientId = 'f70ff5fd6915496bb05f9f259aa7a81b';
  const clientSecret = 'ac8504d5896b49a3a093c9c3f06287a7';
  const redirectUri = 'http://localhost:5173/';

  const redirectToSpotify = () => {
    const scopes = 'playlist-read-private playlist-modify-public playlist-modify-private user-library-read user-library-modify';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
  };

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      fetchAccessToken(code);
    }
  }, []);

  useEffect(()=>{
    getPlaylists()
    getLiked()
  },[token])

  useEffect(()=>{
    getTracks()
  },[playlists.length>0])

  const fetchAccessToken = async (code) => {
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
    });

    const data = await response.json();
    setToken(data.access_token);

    const idUrl = 'https://api.spotify.com/v1/me';
    const fetchUser = await fetch(idUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + data.access_token,
      }
    });
    const user = await fetchUser.json();
    setUserId(user.id);
  };

  async function getPlaylists () {
    const playlistUrl = `https://api.spotify.com/v1/users/${userId}/playlists`;
    const fetchPlaylists = await fetch(playlistUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
      }
    });
    const result = await fetchPlaylists.json();
    const playlistsArray = result.items;
    setPlaylists(playlistsArray.map(item => ({
      playlist_id: item.id,
      name: item.name,
      public: item.public,
      collaborative: item.collaborative,
      description: item.description,
      images: item.images
    })));  
  };

  async function getTracks () {
    for (const playlist of playlists) {
      const tracksUrl = `https://api.spotify.com/v1/playlists/${playlist.playlist_id}/tracks`;
      const fetchTracks = await fetch(tracksUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      });

      const result = await fetchTracks.json();
      const tracks = result.items.map(track => track.track.uri);

      setTracksPerPlaylists(old => [...old, {
        playlist_id: playlist.playlist_id,
        name: playlist.name,
        public: playlist.public,
        collaborative: playlist.collaborative,
        description: playlist.description,
        tracks
      }]);
    }  
  };

  const downloadJSON = (data, filename = 'data.json') => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getImportedData = (e) => {
    const file = e.target.files[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const jsonStr = e.target.result;
          const jsonData = JSON.parse(jsonStr);

          setImportedData(jsonData)

        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      };

      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
      };

      reader.readAsText(file);
    }
  };


  async function getLiked () {
    const likedUrl = "https://api.spotify.com/v1/me/tracks?limit=50";
    const fetchLiked = await fetch(likedUrl, {
      method: "GET",
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    const result = await fetchLiked.json();
    setLikedTracks(result.items.map(track => track.track.id));
    console.log("liked : ")
    console.log(result.items.map(track => track.track.id))
  };

  const importPlaylist = async () => {
    for (const playlist of importedData) {
      const createPlaylistUrl = `https://api.spotify.com/v1/users/${userId}/playlists`;

      const fetchCreatePlaylist = await fetch(createPlaylistUrl, {
        method: "POST",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: playlist.name,
          public: playlist.public,
          collaborative: playlist.collaborative,
          description: playlist.description
        })
      });
      
      const newPlaylist = await fetchCreatePlaylist.json();

      const addTracksUrl = `https://api.spotify.com/v1/playlists/${newPlaylist.id}/tracks`;
      const fetchAddTracks = await fetch(addTracksUrl, {
        method: "POST",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: playlist.tracks,
        })
      });

      const result = await fetchAddTracks.json();
    }
  }

  const importLiked = async () =>{
    const likedTracks = importedData[importedData.length-1].liked;
    const reversedArray = [...likedTracks].reverse();
    for (const i of reversedArray) {
      console.log(i)
      const setLikedUrl = "https://api.spotify.com/v1/me/tracks?ids="+i

      const fetchSetLiked = await fetch(setLikedUrl, {
        method: "PUT",
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
       
      });
      await sleep(1000)
    }

    
          
    
  }

  const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const toggleChecked = (playlistName) => {
    if (checked.includes(playlistName)) {
      setChecked(checked.filter(name => name !== playlistName));
    } else {
      setChecked([...checked, playlistName]);
    }
  };

  return (
    <>
      <h3 className="title" >backup my spotify</h3>
      {!token && (
        <div style={{display:"flex",alignItems:"centrer",justifyContent:"center"}} >
          <input className="connextionBtn" type="button" value="Connect to Spotify" onClick={redirectToSpotify} />
        </div>
      )}
      {token && (
        <>
        
          
          {playlists.length > 0 && (
            <>
              <div className="container">
                {playlists.map((playlist)=>(
                  <div className="playlist" style={{}} onClick={()=>{toggleChecked(playlist.name)}} >
                    <div className="img">
                      <img src={playlist.images[1].url} alt="playlist image" />
                    </div>
                    <span className="name">{playlist.name}</span>
                    <span>playlist</span>
                    <div className="checked"  >
                      {checked.includes(playlist.name) &&(
                        <svg height="30px" width="30px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <g>
                            <g id="check_x5F_alt">
                              <path style={{ fill: '#1DB954' }} d="M16,0C7.164,0,0,7.164,0,16s7.164,16,16,16s16-7.164,16-16S24.836,0,16,0z M13.52,23.383 L6.158,16.02l2.828-2.828l4.533,4.535l9.617-9.617l2.828,2.828L13.52,23.383z"></path>
                            </g>
                          </g>
                        </g>
                      </svg>
                      )}
                      
                    </div>
                  </div>
                ))}

                <div className="liked playlist" onClick={()=>{toggleChecked("Liked Songs")}} >
                  <div className="img">
                    <img src="https://i.scdn.co/image/ab67706c0000da8470d229cb865e8d81cdce0889" alt="liked image" />
                  </div>
                  <span className="name">Liked Songs</span>
                  <span>playlist</span>
                  <div className="checked" >
                      {checked.includes("Liked Songs") &&(
                        <svg height="30px" width="30px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <g>
                            <g id="check_x5F_alt">
                              <path style={{ fill: '#1DB954' }} d="M16,0C7.164,0,0,7.164,0,16s7.164,16,16,16s16-7.164,16-16S24.836,0,16,0z M13.52,23.383 L6.158,16.02l2.828-2.828l4.533,4.535l9.617-9.617l2.828,2.828L13.52,23.383z"></path>
                            </g>
                          </g>
                        </g>
                      </svg>
                      )}
                      
                    </div>
                </div>
              </div>
              
            </>
          )}
         
          {tracksPerPlaylists.length > 0 && (
            <input type="button" value="Export" onClick={() => downloadJSON(tracksPerPlaylists, "export.json")} />
          )}

          {likedTracks.length > 0 && (
            <input type="button" value="Export Liked" onClick={() => downloadJSON(likedTracks, "liked_tracks.json")} />
          )}

          <input type="file" name="import" onChange={getImportedData} />
            <input type="button" value="import Playlists" onClick={importPlaylist} />
            <input type="button" value="import Liked" onClick={importLiked} />
            
        </>
      )}
    </>
  );
}

export default App;
