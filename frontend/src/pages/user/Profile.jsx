import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios'
import './Profile.css';
import Header from '../../components/header';
import Posts from './Posts';
import Reviews from './Reviews';
import './Profile.css';
import BottomNav from '../../components/BottomNav';
import ProfileEdit from './UpdateProfile';

export default function Profile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
        try {
            const [profileRes, postsRes, reviewsRes] = await Promise.all([
                axios.get(`http://localhost/api/user/${userId}`, { withCredentials: true }),
                axios.get(`http://localhost/api/board/user/${userId}`, { withCredentials: true }),
                axios.get(`http://localhost/api/review/${userId}?pageNumber=0&pageSize=10`, { withCredentials: true }),
            ]);

            setProfile(profileRes.data);
            setPosts(postsRes.data);
            setReviews(reviewsRes.data);
        } catch (error) {
            console.error('프로필 데이터 로딩 실패:', error);
        }
    };

    fetchAll();
}, [userId]);

  if (!profile) return <div>Loading...</div>;

  return (
    <>
      <Header />
      <div className='main-container'>
        <div className='profile-container'>
          <div className='profile-section'>
            <img 
              className='profile-image' 
              src={profile.profileImageUrl} 
              alt="profile" 
            />
            <div classname='user-info'>
              <Link to="/user/update">
                <button className='update-profile-button'>
                  프로필 수정
                </button>
              </Link>
              <h2 className='nickname'>{profile.nickname}</h2>
              {console.log('Profile scope raw value:', profile.scope)}
              <h3 classname='scope'>⭐️별점: {profile.scope ? profile.scope.toFixed(1) : 'N/A'}</h3>
            </div>
          </div>
          <div className='tab-bar'>
            <button className={activeTab === 'posts' ? 'active' : ''} onClick={() => setActiveTab('posts')}>게시글</button>
            <button className={activeTab === 'reviews' ? 'active' : ''} onClick={() => setActiveTab('reviews')}>리뷰</button>
          </div>
          {activeTab === 'posts' && (
            <div className='post-section'>
              {posts.map((item) => (
                <Link to={`/board/deal/${item.id}`} key={item.id} className='post'>
                  <img src={item.imageUrl} alt={`post-${item.imageUrl}`} />
                </Link>
              ))}
            </div>
          )}
          {activeTab === 'reviews' && (
            <div className='review-section'>
              {reviews.map((item, index) => (
                <div className='review-item' key={index}>
                  <div className='review-score'>⭐ {item.scope}</div>
                  <div className='review-content'>{item.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
